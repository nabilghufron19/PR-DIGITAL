// Data murid (admin). Import: upsert per NIS, sandi awal = NIS bila kolom password kosong
import { route, json, qid, hashPw } from '../_lib/core.js';
const A = ['admin'];

export const onRequestGet = route(A, (_, __, sql) => sql`select id,nis,nama,kelas,aktif from users where role='murid' order by kelas,nama`.then(json));
export const onRequestPost = route(A, async ({ request }, _, sql) => {
  const b = await request.json(), list = Array.isArray(b) ? b : [b];
  const rows = list.map(x => ({ nis: String(x.nis || '').trim(), nama: String(x.nama || '').trim(), kelas: String(x.kelas || '').trim(), pw: String(x.password || x.nis || '').trim() }))
    .filter(r => r.nis && r.nama);
  if (!rows.length) throw new Error('NIS dan nama wajib diisi');
  const hs = await Promise.all(rows.map(r => hashPw(r.pw)));
  await sql.transaction(rows.map((r, i) => sql`insert into users(nis,nama,kelas,pass_hash) values(${r.nis},${r.nama},${r.kelas},${hs[i]})
    on conflict (nis) do update set nama=excluded.nama, kelas=excluded.kelas where users.role='murid'`));
  return json({ ok: true, dibuat: rows.length, dilewati: list.length - rows.length });
});
export const onRequestPut = route(A, async ({ request }, _, sql) => {
  const id = qid(request), b = await request.json();
  await sql`update users set nama=${String(b.nama || '').trim()}, kelas=${String(b.kelas || '').trim()}, aktif=${b.aktif !== 'false' && b.aktif !== false} where id=${id} and role='murid'`;
  if (b.password) await sql`update users set pass_hash=${await hashPw(String(b.password))} where id=${id} and role='murid'`;
  return json({ ok: true });
});
export const onRequestDelete = route(A, async ({ request }, _, sql) => {
  await sql`delete from users where id=${qid(request)} and role='murid'`;
  return json({ ok: true });
});
