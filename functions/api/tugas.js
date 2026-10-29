// Tugas hibrida (admin & guru). Satu tugas = satu isi + satu sasaran + satu jadwal; tiap murid sasaran mendapat satu baris penugasan.
// mode 'online' = murid mencentang sendiri; mode 'setor' = guru menandai saat buku diterima (lihat setor.js);
// mode 'kuis' = murid membaca materi (tugas.isi) lalu menjawab soal pilihan ganda yang disalin dari paket (lihat kuis.js).
// Admin melihat semua tugas di lembaganya; guru hanya tugas buatannya sendiri.
import { route, json, bad, body, qid } from '../_lib/core.js';
const R = ['admin', 'guru'];
const LIMIT = 500, MAX_MURID = 500;
const MODE = ['online', 'setor', 'kuis'];

async function ambil(sql, u, id) {
  const [t] = await sql`select t.id,t.judul,t.mapel,t.isi,t.mode,t.mulai,t.tenggat,t.sasaran,t.dibuat_oleh
    from tugas t where t.id=${id} and t.lembaga_id=${u.lembaga_id} and (${u.role}='admin' or t.dibuat_oleh=${u.id})`;
  if (!t) throw bad('Tugas tidak ditemukan');
  return t;
}
function tanggal(mulai, tenggat) {
  const t = new Date(tenggat), m = mulai ? new Date(mulai) : new Date();
  if (!tenggat || isNaN(t) || isNaN(m)) throw bad('Format tanggal tidak valid');
  if (t <= m) throw bad('Tenggat harus setelah waktu mulai');
  return [m, t];
}

export const onRequestGet = route(R, async ({ request }, u, sql) => {
  const sid = new URL(request.url).searchParams.get('id');
  if (sid !== null) { // rekap satu tugas: daftar murid + status
    const tugas = await ambil(sql, u, qid(request));
    const murid = await sql`select p.id,u.nis,u.nama,u.kelas,p.status,p.selesai_at,p.ditandai_oleh,p.skor_terbaik skor,p.percobaan
      from penugasan p join users u on u.id=p.user_id
      where p.tugas_id=${tugas.id} and p.lembaga_id=${u.lembaga_id} order by u.kelas,u.nama`;
    // Kuis: berapa murid yang salah di tiap soal pada percobaan PERTAMA (ukuran paling jujur untuk bagian materi yang sulit)
    const soal = tugas.mode !== 'kuis' ? [] : await sql`select s.id,s.urut,s.tanya,s.kunci,
        count(j.soal_id)::int dijawab, (count(j.soal_id) filter (where not j.benar))::int salah
      from tugas_soal s left join jawaban j on j.soal_id=s.id and j.percobaan=1
      where s.tugas_id=${tugas.id} and s.lembaga_id=${u.lembaga_id}
      group by s.id order by s.urut,s.id`;
    return json({ tugas, murid, soal });
  }
  return json(await sql`
    select t.id,t.judul,t.mapel,t.mode,t.mulai,t.tenggat,t.sasaran,g.nama pembuat,
      count(p.id) filter (where p.status='aktif')::int total,
      count(p.id) filter (where p.status='aktif' and p.selesai_at is not null)::int selesai,
      count(p.id) filter (where p.status='dicabut')::int dicabut
    from tugas t left join penugasan p on p.tugas_id=t.id left join users g on g.id=t.dibuat_oleh
    where t.lembaga_id=${u.lembaga_id} and (${u.role}='admin' or t.dibuat_oleh=${u.id})
    group by t.id, g.nama order by t.tenggat desc, t.id desc limit ${LIMIT}`);
});

// Buat tugas. Isi bisa diambil dari bank soal (soal_id) atau ditulis langsung. Mode "kuis": isi (materi) dan soal disalin dari paket (paket_id).
// Sasaran: tingkat dan/atau kelas (keduanya kosong + tanpa murid_ids = semua murid aktif), ditambah murid tertentu (murid_ids).
// Jika hanya murid_ids yang diisi, sasarannya persis murid-murid itu.
export const onRequestPost = route(R, async ({ request }, u, sql) => {
  const b = await body(request);
  let judul = String(b.judul ?? '').trim(), mapel = String(b.mapel ?? '').trim(), isi = String(b.isi ?? '').trim();
  const mode = b.mode ?? 'online';
  if (!MODE.includes(mode)) throw bad('Mode tidak valid');
  let sid = null, pid = null;
  if (mode === 'kuis') {
    pid = +b.paket_id;
    if (!Number.isInteger(pid) || pid < 1) throw bad('Pilih paket kuis dulu');
    const [pk] = await sql`select p.judul,p.mapel,p.materi,(select count(*) from paket_soal s where s.paket_id=p.id)::int n
      from paket p where p.id=${pid} and p.lembaga_id=${u.lembaga_id}`;
    if (!pk) throw bad('Paket tidak ditemukan');
    if (!pk.n) throw bad('Paket ini belum punya soal');
    judul ||= pk.judul; mapel ||= pk.mapel; isi = pk.materi; // materi selalu mengikuti paket
  } else if (b.soal_id) {
    sid = +b.soal_id;
    if (!Number.isInteger(sid) || sid < 1) throw bad('Soal tidak valid');
    const [s] = await sql`select judul,mapel,isi from soal where id=${sid} and lembaga_id=${u.lembaga_id}`;
    if (!s) throw bad('Soal tidak ditemukan');
    judul ||= s.judul; mapel ||= s.mapel; isi ||= s.isi;
  }
  if (!judul || !mapel || !isi) throw bad('Judul, mapel, dan isi wajib diisi (atau pilih dari bank soal / paket kuis)');
  const [m, t] = tanggal(b.mulai, b.tenggat);
  const tingkat = String(b.tingkat ?? '').trim(), kelas = String(b.kelas ?? '').trim();
  const ids = [...new Set((Array.isArray(b.murid_ids) ? b.murid_ids : []).map(Number))];
  if (ids.some(i => !Number.isInteger(i) || i < 1)) throw bad('Pilihan murid tidak valid');
  if (ids.length > MAX_MURID) throw bad(`Maksimal ${MAX_MURID} murid yang dipilih satu per satu`);

  // Sasaran dihitung di SQL; tetap dibatasi ke murid aktif di lembaga ini
  const [{ n }] = await sql`select count(*)::int n from users x where x.role='murid' and x.aktif and x.lembaga_id=${u.lembaga_id}
    and (x.id = any(${ids}::int[]) or ((${tingkat}<>'' or ${kelas}<>'' or cardinality(${ids}::int[])=0)
      and (${tingkat}='' or x.tingkat=${tingkat}) and (${kelas}='' or x.kelas=${kelas})))`;
  if (!n) throw bad('Tidak ada murid aktif yang cocok dengan sasaran ini');
  const sasaran = [tingkat && 'Tingkat ' + tingkat, kelas, ids.length && ids.length + ' murid'].filter(Boolean).join(' + ') || 'Semua murid';

  // Satu statement = atomik: tugas, salinan soal kuis (hanya bila pid terisi), dan penugasan tiap murid
  const r = await sql`with t as (
      insert into tugas(lembaga_id,soal_id,judul,mapel,isi,mode,mulai,tenggat,sasaran,dibuat_oleh)
      values(${u.lembaga_id},${sid},${judul},${mapel},${isi},${mode},${m.toISOString()}::timestamptz,${t.toISOString()}::timestamptz,${sasaran},${u.id})
      returning id),
    ts as (
      insert into tugas_soal(tugas_id,lembaga_id,urut,tanya,a,b,c,d,kunci,bahas)
      select t.id,${u.lembaga_id},s.urut,s.tanya,s.a,s.b,s.c,s.d,s.kunci,s.bahas
      from t, paket_soal s where s.paket_id=${pid} and s.lembaga_id=${u.lembaga_id})
    insert into penugasan(tugas_id,user_id,lembaga_id)
    select t.id, x.id, ${u.lembaga_id} from t, users x
    where x.role='murid' and x.aktif and x.lembaga_id=${u.lembaga_id}
      and (x.id = any(${ids}::int[]) or ((${tingkat}<>'' or ${kelas}<>'' or cardinality(${ids}::int[])=0)
        and (${tingkat}='' or x.tingkat=${tingkat}) and (${kelas}='' or x.kelas=${kelas})))
    returning tugas_id`;
  return json({ ok: true, jumlah: r.length, id: r[0]?.tugas_id });
});

// Ubah isi (untuk kuis: materi)/jadwal/mode tugas. Sasaran dan soal kuis tidak bisa diubah; buat tugas baru untuk itu.
export const onRequestPut = route(R, async ({ request }, u, sql) => {
  const id = qid(request), b = await body(request), lama = await ambil(sql, u, id);
  const judul = String(b.judul ?? '').trim(), mapel = String(b.mapel ?? '').trim(), isi = String(b.isi ?? '').trim();
  if (!judul || !mapel || !isi) throw bad('Judul, mapel, dan isi wajib diisi');
  const mode = b.mode ?? lama.mode;
  if (!MODE.includes(mode)) throw bad('Mode tidak valid');
  if ((mode === 'kuis') !== (lama.mode === 'kuis')) throw bad('Cara mengumpulkan tidak bisa diubah dari atau ke Kuis. Buat tugas baru.');
  const [m, t] = tanggal(b.mulai || lama.mulai, b.tenggat || lama.tenggat);
  await sql`update tugas set judul=${judul}, mapel=${mapel}, isi=${isi}, mode=${mode},
    mulai=${m.toISOString()}::timestamptz, tenggat=${t.toISOString()}::timestamptz where id=${id} and lembaga_id=${u.lembaga_id}`;
  return json({ ok: true });
});

// Cabut / aktifkan kembali penugasan terpilih (per murid)
export const onRequestPatch = route(R, async ({ request }, u, sql) => {
  const { ids = [], status } = await body(request);
  if (!['aktif', 'dicabut'].includes(status)) throw bad('Status tidak valid');
  const list = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger);
  if (!list.length) throw bad('Pilih penugasan dulu');
  await sql`update penugasan p set status=${status} from tugas t
    where t.id=p.tugas_id and p.id = any(${list}::int[]) and t.lembaga_id=${u.lembaga_id} and (${u.role}='admin' or t.dibuat_oleh=${u.id})`;
  return json({ ok: true });
});

export const onRequestDelete = route(R, async ({ request }, u, sql) => {
  const r = await sql`delete from tugas where id=${qid(request)} and lembaga_id=${u.lembaga_id} and (${u.role}='admin' or dibuat_oleh=${u.id}) returning id`;
  if (!r.length) throw bad('Tugas tidak ditemukan');
  return json({ ok: true });
});
