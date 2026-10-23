// Bank soal (admin). POST menerima objek tunggal atau array (import Excel)
import { route, json, qid } from '../_lib/core.js';
const A = ['admin'];
const row = b => [String(b.judul || '').trim(), String(b.mapel || '').trim(), String(b.isi || '').trim()];

export const onRequestGet = route(A, (_, __, sql) => sql`select id,judul,mapel,isi,created_at from soal order by id desc`.then(json));
export const onRequestPost = route(A, async ({ request }, u, sql) => {
  const b = await request.json(), list = Array.isArray(b) ? b : [b];
  const rows = list.map(row).filter(r => r[0] && r[1] && r[2]);
  if (!rows.length) throw new Error('Judul, mapel, dan isi wajib diisi');
  await sql.transaction(rows.map(r => sql`insert into soal(judul,mapel,isi,dibuat_oleh) values(${r[0]},${r[1]},${r[2]},${u.id})`));
  return json({ ok: true, dibuat: rows.length, dilewati: list.length - rows.length });
});
export const onRequestPut = route(A, async ({ request }, _, sql) => {
  const [judul, mapel, isi] = row(await request.json());
  await sql`update soal set judul=${judul}, mapel=${mapel}, isi=${isi} where id=${qid(request)}`;
  return json({ ok: true });
});
export const onRequestDelete = route(A, async ({ request }, _, sql) => {
  await sql`delete from soal where id=${qid(request)}`; // penugasan ikut terhapus (cascade)
  return json({ ok: true });
});
