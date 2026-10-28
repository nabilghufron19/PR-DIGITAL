// Ganti kata sandi sendiri (admin & murid). Sesi lama otomatis tidak berlaku, cookie baru diterbitkan.
import { route, json, bad, body, checkPw, hashPw, makeCookie } from '../_lib/core.js';

export const onRequestPost = route(['admin', 'murid'], async ({ request, env }, u, sql) => {
  const { lama = '', baru = '' } = await body(request);
  const b = String(baru);
  if (b.length < 6) throw bad('Kata sandi baru minimal 6 karakter');
  if (b.toLowerCase() === u.nis.toLowerCase()) throw bad('Kata sandi baru tidak boleh sama dengan NIS / username');
  if (!(await checkPw(String(lama), u.pass_hash))) throw bad('Kata sandi lama salah');
  const pass_hash = await hashPw(b);
  await sql`update users set pass_hash=${pass_hash}, ganti_sandi=false where id=${u.id}`;
  return json({ ok: true }, 200, { 'set-cookie': await makeCookie(env, { id: u.id, pass_hash }) });
});
