// POST = login (kode lembaga + username + sandi), GET = cek sesi, DELETE = logout
import { route, json, body, checkPw, hashPw, makeCookie, clearCookie, profil } from '../_lib/core.js';
const MAX_GAGAL = 5, KUNCI_MENIT = 15;
const KODE_PLATFORM = 'platform';

export const onRequestPost = route(null, async ({ request, env }, _, sql) => {
  const b = await body(request);
  const kode = String(b.kode ?? '').trim().toLowerCase().slice(0, 50);
  const nis = String(b.username ?? '').trim().toLowerCase().slice(0, 100), pw = String(b.password ?? '');
  if (!kode || !nis || !pw) return json({ ok: false, message: 'Isi kode lembaga, username, dan kata sandi dulu ya.' }, 400);

  // Batasi percobaan login berulang per lembaga + username
  const kunci = kode + ':' + nis;
  const [lk] = await sql`select gagal from login_gagal where nis=${kunci} and gagal>=${MAX_GAGAL} and terakhir > now() - make_interval(mins => ${KUNCI_MENIT})`;
  if (lk) return json({ ok: false, message: `Terlalu banyak percobaan. Coba lagi dalam ${KUNCI_MENIT} menit.` }, 429);

  // Bootstrap: jika lembaga "platform" belum punya admin, akun dari env ADMIN_USER/ADMIN_PASS dibuat otomatis
  if (kode === KODE_PLATFORM && env.ADMIN_USER && env.ADMIN_PASS && nis === env.ADMIN_USER.toLowerCase() && pw === env.ADMIN_PASS) {
    const [ada] = await sql`select 1 x from users u join lembaga l on l.id=u.lembaga_id where l.platform and u.role='admin'`;
    if (!ada) {
      await sql`insert into lembaga(kode,nama,platform) values(${KODE_PLATFORM},'Platform',true) on conflict (kode) do nothing`;
      await sql`insert into users(lembaga_id,nis,nama,role,pass_hash)
        select id,${nis},'Admin Platform','admin',${await hashPw(pw)} from lembaga where kode=${KODE_PLATFORM} and platform
        on conflict do nothing`;
    }
  }

  const [u] = await sql`select u.id,u.nama,u.role,u.pass_hash,u.ganti_sandi,l.nama lembaga,l.istilah_kelas,l.platform
    from users u join lembaga l on l.id=u.lembaga_id
    where l.kode=${kode} and l.aktif and lower(u.nis)=${nis} and u.aktif`;
  if (!u || !(await checkPw(pw, u.pass_hash))) {
    await sql`insert into login_gagal(nis,gagal,terakhir) values(${kunci},1,now())
      on conflict (nis) do update set
        gagal = case when login_gagal.terakhir < now() - make_interval(mins => ${KUNCI_MENIT}) then 1 else login_gagal.gagal + 1 end,
        terakhir = now()`;
    return json({ ok: false, message: 'Kode lembaga, username, atau kata sandi salah.' }, 401);
  }
  await sql`delete from login_gagal where nis=${kunci}`;
  return json({ ok: true, user: profil(u) }, 200, { 'set-cookie': await makeCookie(env, u) });
});
export const onRequestGet = route(['admin', 'guru', 'murid'], async (_, u) => json(profil(u)));
export const onRequestDelete = route(null, async () => json({ ok: true }, 200, { 'set-cookie': clearCookie }));
