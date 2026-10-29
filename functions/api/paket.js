// Paket latihan: satu materi + soal pilihan ganda. Admin & guru.
// Guru hanya mengubah paket buatannya; admin semua paket di lembaganya. Semua staf boleh membaca & memakai paket lembaganya.
// Paket milik lembaga "platform" = TEMPLATE: terlihat oleh semua lembaga (GET ?template=1) dan bisa disalin (POST ?salin=ID).
import { route, json, bad, body, qid } from '../_lib/core.js';
import { milik, teks } from '../_lib/paket.js';
const R = ['admin', 'guru'];
const MAKS_MATERI = 20000;
const param = (request, k) => new URL(request.url).searchParams.get(k);

export const onRequestGet = route(R, async ({ request }, u, sql) => {
  if (param(request, 'template') !== null) { // daftar template dari platform
    return json(await sql`
      select p.id,p.judul,p.mapel,(select count(*) from paket_soal s where s.paket_id=p.id)::int jumlah
      from paket p join lembaga l on l.id=p.lembaga_id
      where l.platform and l.aktif order by p.mapel,p.judul`);
  }
  if (param(request, 'id') !== null) { // satu paket lengkap dengan soalnya (kunci ikut: hanya untuk staf)
    const id = qid(request);
    const [paket] = await sql`select p.id,p.judul,p.mapel,p.materi,p.dibuat_oleh,g.nama pembuat
      from paket p left join users g on g.id=p.dibuat_oleh
      where p.id=${id} and p.lembaga_id=${u.lembaga_id}`;
    if (!paket) throw bad('Paket tidak ditemukan');
    const soal = await sql`select id,urut,tanya,a,b,c,d,kunci,bahas from paket_soal
      where paket_id=${id} and lembaga_id=${u.lembaga_id} order by urut,id`;
    return json({ paket, soal });
  }
  return json(await sql`
    select p.id,p.judul,p.mapel,p.dibuat_oleh,g.nama pembuat,
      (select count(*) from paket_soal s where s.paket_id=p.id)::int jumlah
    from paket p left join users g on g.id=p.dibuat_oleh
    where p.lembaga_id=${u.lembaga_id} order by p.id desc`);
});

export const onRequestPost = route(R, async ({ request }, u, sql) => {
  const salin = param(request, 'salin');
  if (salin !== null) { // salin template platform menjadi paket milik lembaga ini (bebas diubah setelahnya)
    const id = Number(salin);
    if (!Number.isInteger(id) || id < 1) throw bad('ID tidak valid');
    if (u.platform) throw bad('Paket platform sudah menjadi template, tidak perlu disalin');
    const [r] = await sql`
      with src as (select p.judul,p.mapel,p.materi from paket p join lembaga l on l.id=p.lembaga_id where p.id=${id} and l.platform),
      np as (insert into paket(lembaga_id,judul,mapel,materi,dibuat_oleh)
             select ${u.lembaga_id},judul,mapel,materi,${u.id} from src returning id),
      ns as (insert into paket_soal(paket_id,lembaga_id,urut,tanya,a,b,c,d,kunci,bahas)
             select np.id,${u.lembaga_id},s.urut,s.tanya,s.a,s.b,s.c,s.d,s.kunci,s.bahas
             from np, paket_soal s where s.paket_id=${id})
      select id from np`;
    if (!r) throw bad('Template tidak ditemukan');
    return json({ ok: true, id: r.id });
  }
  const b = await body(request);
  const judul = teks(b.judul, 150, 'Judul'), mapel = teks(b.mapel, 60, 'Mata pelajaran'), materi = teks(b.materi, MAKS_MATERI, 'Materi');
  if (!judul || !mapel || !materi) throw bad('Judul, mapel, dan materi wajib diisi');
  const [r] = await sql`insert into paket(lembaga_id,judul,mapel,materi,dibuat_oleh)
    values(${u.lembaga_id},${judul},${mapel},${materi},${u.id}) returning id`;
  return json({ ok: true, id: r.id });
});

export const onRequestPut = route(R, async ({ request }, u, sql) => {
  const id = qid(request), b = await body(request);
  await milik(sql, u, id);
  const judul = teks(b.judul, 150, 'Judul'), mapel = teks(b.mapel, 60, 'Mata pelajaran'), materi = teks(b.materi, MAKS_MATERI, 'Materi');
  if (!judul || !mapel || !materi) throw bad('Judul, mapel, dan materi wajib diisi');
  await sql`update paket set judul=${judul}, mapel=${mapel}, materi=${materi} where id=${id} and lembaga_id=${u.lembaga_id}`;
  return json({ ok: true });
});

export const onRequestDelete = route(R, async ({ request }, u, sql) => {
  const id = qid(request);
  await milik(sql, u, id); // tugas yang sudah dibuat dari paket ini tetap ada (isinya sudah disalin)
  await sql`delete from paket where id=${id} and lembaga_id=${u.lembaga_id}`;
  return json({ ok: true });
});
