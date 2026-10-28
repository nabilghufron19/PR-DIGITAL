// POST = login, GET = cek sesi, DELETE = logout
import { route, json, bad, body, checkPw, hashPw, makeCookie, clearCookie } from '../_lib/core.js';
const MAX_GAGAL = 5, KUNCI_MENIT = 15;

export const onRequestPost = route(null, async ({ request, env }, _, sql) => {
  const { username = '', password = '' } = await body(request);
  const nis = String(username).trim().toLowerCase().slice(0, 100), pw = String(password);
  if (!nis || !pw) return json({ ok: false, message: 'Isi username dan kata sandi dulu ya.' }, 400);

  // Batasi percobaan login berulang per username
  const [lk] = await sql`select gagal from login_gagal where nis=${nis} and gagal>=${MAX_GAGAL} and terakhir > now() - make_interval(mins => ${KUNCI_MENIT})`;
  if (lk) return json({ ok: false, message: `Terlalu banyak percobaan. Coba lagi dalam ${KUNCI_MENIT} menit.` }, 429);

  // Bootstrap: jika belum ada admin, akun dari env ADMIN_USER/ADMIN_PASS dibuat otomatis
  const [n] = await sql`select count(*)::int c from users where role='admin'`;
  if (!n.c && env.ADMIN_USER && env.ADMIN_PASS && nis === env.ADMIN_USER.toLowerCase() && pw === env.ADMIN_PASS)
    await sql`insert into users(nis,nama,role,pass_hash) values(${nis},'Admin','admin',${await hashPw(pw)}) on conflict do nothing`;

  const [u] = await sql`select id,nama,role,pass_hash,ganti_sandi from users where lower(nis)=${nis} and aktif`;
  if (!u || !(await checkPw(pw, u.pass_hash))) {
    await sql`insert into login_gagal(nis,gagal,terakhir) values(${nis},1,now())
      on conflict (nis) do update set
        gagal = case when login_gagal.terakhir < now() - make_interval(mins => ${KUNCI_MENIT}) then 1 else login_gagal.gagal + 1 end,
        terakhir = now()`;
    return json({ ok: false, message: 'Username atau kata sandi salah.' }, 401);
  }
  await sql`delete from login_gagal where nis=${nis}`;
  return json({ ok: true, user: { name: u.nama, role: u.role, wajib: u.ganti_sandi } }, 200, { 'set-cookie': await makeCookie(env, u) });
});
export const onRequestGet = route(['admin', 'murid'], async (_, u) => json({ name: u.nama, role: u.role, wajib: u.ganti_sandi }));
export const onRequestDelete = route(null, async () => json({ ok: true }, 200, { 'set-cookie': clearCookie }));
