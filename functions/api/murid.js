// Data murid (admin). Import: upsert per NIS, sandi awal = NIS bila kolom password kosong (murid wajib menggantinya)
import { route, json, bad, body, qid, hashPw } from '../_lib/core.js';
const A = ['admin'];
const MAX_BARIS = 10; // PBKDF2 berat di CPU Workers: batasi jumlah hash per request

export const onRequestGet = route(A, (_, __, sql) => sql`select id,nis,nama,kelas,aktif from users where role='murid' order by kelas,nama`.then(json));
export const onRequestPost = route(A, async ({ request }, _, sql) => {
  const b = await body(request), list = Array.isArray(b) ? b : [b];
  if (list.length > MAX_BARIS) throw bad(`Maksimal ${MAX_BARIS} murid per permintaan`);
  const rows = list.map(x => {
    const pwIn = String(x.password ?? '').trim(), nis = String(x.nis ?? '').trim();
    return { nis, nama: String(x.nama ?? '').trim(), kelas: String(x.kelas ?? '').trim(), pw: pwIn || nis, wajib: !pwIn };
  }).filter(r => r.nis && r.nama);
  if (!rows.length) throw bad('NIS dan nama wajib diisi');
  const hs = await Promise.all(rows.map(r => hashPw(r.pw)));
  // NIS dibandingkan tanpa membedakan huruf besar/kecil; akun admin tidak pernah ditimpa
  const res = await sql.transaction(rows.map((r, i) => sql`insert into users(nis,nama,kelas,pass_hash,ganti_sandi) values(${r.nis},${r.nama},${r.kelas},${hs[i]},${r.wajib})
    on conflict ((lower(nis))) do update set nama=excluded.nama, kelas=excluded.kelas where users.role='murid'
    returning id`));
  const dibuat = res.filter(x => x.length).length;
  return json({ ok: true, dibuat, dilewati: list.length - dibuat });
});
export const onRequestPut = route(A, async ({ request }, _, sql) => {
  const id = qid(request), b = await body(request);
  const nama = String(b.nama || '').trim();
  if (!nama) throw bad('Nama wajib diisi');
  const h = b.password ? await hashPw(String(b.password)) : null;
  await sql`update users set nama=${nama}, kelas=${String(b.kelas || '').trim()}, aktif=${b.aktif !== 'false' && b.aktif !== false},
    pass_hash=coalesce(${h}::text, pass_hash), ganti_sandi = ganti_sandi or ${!!h}
    where id=${id} and role='murid'`;
  return json({ ok: true });
});
export const onRequestDelete = route(A, async ({ request }, _, sql) => {
  await sql`delete from users where id=${qid(request)} and role='murid'`;
  return json({ ok: true });
});
