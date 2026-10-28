// Penjadwalan, penugasan, dan pencabutan soal (admin)
import { route, json, bad, body } from '../_lib/core.js';
const A = ['admin'];
const LIMIT = 5000;

export const onRequestGet = route(A, (_, __, sql) => sql`
  select p.id,p.soal_id,s.judul,s.mapel,u.nis,u.nama,u.kelas,p.mulai,p.tenggat,p.status,p.selesai_at
  from penugasan p join soal s on s.id=p.soal_id join users u on u.id=p.user_id
  order by p.tenggat desc, u.nama limit ${LIMIT}`.then(json));

// Tugaskan satu soal ke satu kelas (kelas kosong = semua murid aktif). Mulai di masa depan = terjadwal.
// Menugaskan ulang soal yang sama ke murid yang sama = mengulang: jadwal diganti, status selesai direset.
export const onRequestPost = route(A, async ({ request }, _, sql) => {
  const { soal_id, kelas = '', mulai = null, tenggat } = await body(request);
  const sid = +soal_id, t = new Date(tenggat), m = mulai ? new Date(mulai) : new Date();
  if (!Number.isInteger(sid) || sid < 1 || !tenggat) throw bad('Soal dan tenggat wajib diisi');
  if (isNaN(t) || isNaN(m)) throw bad('Format tanggal tidak valid');
  if (t <= m) throw bad('Tenggat harus setelah waktu mulai');
  const [ada] = await sql`select 1 x from soal where id=${sid}`;
  if (!ada) throw bad('Soal tidak ditemukan');
  const r = await sql`insert into penugasan(soal_id,user_id,mulai,tenggat)
    select ${sid}, id, ${m.toISOString()}::timestamptz, ${t.toISOString()}::timestamptz
    from users where role='murid' and aktif and (${String(kelas)}='' or kelas=${String(kelas)})
    on conflict (soal_id,user_id) do update set mulai=excluded.mulai, tenggat=excluded.tenggat, status='aktif', selesai_at=null
    returning id`;
  return json({ ok: true, jumlah: r.length });
});

// Cabut / aktifkan kembali penugasan terpilih
export const onRequestPatch = route(A, async ({ request }, _, sql) => {
  const { ids = [], status } = await body(request);
  if (!['aktif', 'dicabut'].includes(status)) throw bad('Status tidak valid');
  const list = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger);
  if (!list.length) throw bad('Pilih penugasan dulu');
  await sql`update penugasan set status=${status} where id = any(${list})`;
  return json({ ok: true });
});
