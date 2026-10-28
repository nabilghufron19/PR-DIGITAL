import { neon } from '@neondatabase/serverless';
const enc = new TextEncoder();
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const safeEq = (a, b) => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};
export const bad = m => Object.assign(new Error(m), { user: true }); // pesan aman ditampilkan ke pengguna
export const forbid = m => Object.assign(bad(m), { status: 403 });
// Data profil yang dikirim ke frontend (login & cek sesi)
export const profil = u => ({ id: u.id, name: u.nama, role: u.role, wajib: u.ganti_sandi, lembaga: u.lembaga, istilah: u.istilah_kelas, platform: u.platform });
export const body = async r => { try { return await r.json(); } catch { throw bad('Data tidak valid'); } };
export const json = (d, status = 200, h = {}) =>
  new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json', ...h } });
export const db = env => neon(env.DATABASE_URL);

async function pbkdf2(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, k, 256);
}
export async function hashPw(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return b64(salt) + '.' + b64(await pbkdf2(pw, salt));
}
export async function checkPw(pw, stored) {
  const [s, h] = stored.split('.');
  return safeEq(b64(await pbkdf2(pw, unb64(s))), h || '');
}
async function hmac(env, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
export async function makeCookie(env, u) {
  // v = potongan hash sandi: ganti sandi otomatis membatalkan sesi lama
  const p = btoa(JSON.stringify({ id: u.id, v: u.pass_hash.slice(0, 12), exp: Date.now() + 6048e5 }));
  return `sid=${p}.${await hmac(env, p)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
}
export const clearCookie = 'sid=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';

export async function auth({ request, env }) {
  try {
    const c = /(?:^|; )sid=([^;]+)/.exec(request.headers.get('cookie') || '');
    if (!c) return null;
    const [p, sig] = c[1].split('.');
    if (!p || !sig || !safeEq(sig, await hmac(env, p))) return null;
    const u = JSON.parse(atob(p));
    return u.exp > Date.now() ? u : null;
  } catch { return null; }
}
// Pembungkus endpoint: cek sesi + status akun & lembaga di database, siapkan koneksi Neon, tangani error.
// Handler menerima (ctx, u, sql); u.lembaga_id WAJIB dipakai di setiap query data agar lembaga tidak saling melihat.
export const route = (roles, fn) => async ctx => {
  try {
    const sql = db(ctx.env);
    let u = null;
    if (roles) {
      const t = await auth(ctx);
      if (!t) return json({ error: 'Silakan login' }, 401);
      [u] = await sql`select u.id,u.nis,u.nama,u.role,u.pass_hash,u.ganti_sandi,u.lembaga_id,l.nama lembaga,l.istilah_kelas,l.platform
        from users u join lembaga l on l.id=u.lembaga_id where u.id=${+t.id || 0} and u.aktif and l.aktif`;
      if (!u || t.v !== u.pass_hash.slice(0, 12)) return json({ error: 'Silakan login' }, 401);
      if (!roles.includes(u.role)) return json({ error: 'Tidak diizinkan' }, 403);
    }
    return await fn(ctx, u, sql);
  } catch (e) {
    if (e.user) return json({ error: e.message }, e.status || 400);
    console.error(e);
    return json({ error: 'Terjadi kesalahan di server' }, 500);
  }
};
export const qid = request => {
  const id = +new URL(request.url).searchParams.get('id');
  if (!Number.isInteger(id) || id < 1) throw bad('ID tidak valid');
  return id;
};
