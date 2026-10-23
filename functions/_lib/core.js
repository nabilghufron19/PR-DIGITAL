import { neon } from '@neondatabase/serverless';
const enc = new TextEncoder();
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
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
  return b64(await pbkdf2(pw, unb64(s))) === h;
}
async function hmac(env, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
export async function makeCookie(env, u) {
  const p = btoa(JSON.stringify({ id: u.id, role: u.role, exp: Date.now() + 6048e5 }));
  return `sid=${p}.${await hmac(env, p)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
}
export const clearCookie = 'sid=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';

export async function auth({ request, env }) {
  const c = /(?:^|; )sid=([^;]+)/.exec(request.headers.get('cookie') || '');
  if (!c) return null;
  const [p, sig] = c[1].split('.');
  if (!p || sig !== (await hmac(env, p))) return null;
  const u = JSON.parse(atob(p));
  return u.exp > Date.now() ? u : null;
}
// Pembungkus endpoint: cek peran, siapkan koneksi Neon, tangani error
export const route = (roles, fn) => async ctx => {
  try {
    const u = await auth(ctx);
    if (roles && (!u || !roles.includes(u.role))) return json({ error: u ? 'Tidak diizinkan' : 'Silakan login' }, u ? 403 : 401);
    return await fn(ctx, u, db(ctx.env));
  } catch (e) { return json({ error: e.message }, 400); }
};
export const qid = request => +new URL(request.url).searchParams.get('id');
