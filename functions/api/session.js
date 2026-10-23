// POST = login, GET = cek sesi, DELETE = logout
import { route, json, checkPw, hashPw, makeCookie, clearCookie } from '../_lib/core.js';

export const onRequestPost = route(null, async ({ request, env }, _, sql) => {
  const { username = '', password = '' } = await request.json();
  const nis = String(username).trim().toLowerCase();
  // Bootstrap: jika belum ada admin, akun dari env ADMIN_USER/ADMIN_PASS dibuat otomatis
  const [n] = await sql`select count(*)::int c from users where role='admin'`;
  if (!n.c && env.ADMIN_USER && nis === env.ADMIN_USER.toLowerCase() && password === env.ADMIN_PASS)
    await sql`insert into users(nis,nama,role,pass_hash) values(${nis},'Admin','admin',${await hashPw(password)})`;
  const [u] = await sql`select id,nama,role,pass_hash from users where lower(nis)=${nis} and aktif`;
  if (!u || !(await checkPw(password, u.pass_hash))) return json({ ok: false, message: 'Username atau kata sandi salah.' }, 401);
  return json({ ok: true, user: { name: u.nama, role: u.role } }, 200, { 'set-cookie': await makeCookie(env, u) });
});
export const onRequestGet = route(['admin', 'murid'], async (_, u, sql) => {
  const [r] = await sql`select nama,role from users where id=${u.id} and aktif`;
  return r ? json({ name: r.nama, role: r.role }) : json({ error: 'Sesi tidak valid' }, 401);
});
export const onRequestDelete = route(null, async () => json({ ok: true }, 200, { 'set-cookie': clearCookie }));
