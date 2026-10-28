// Pengelolaan lembaga: hanya admin dari lembaga platform
import { route, json, bad, forbid, body, qid, hashPw } from '../_lib/core.js';
const P = async (_, u) => { if (!u.platform) throw forbid('Hanya admin platform yang boleh mengelola lembaga'); };
const guard = fn => route(['admin'], async (ctx, u, sql) => { await P(ctx, u); return fn(ctx, u, sql); });

export const onRequestGet = guard((_, __, sql) => sql`
  select l.id,l.kode,l.nama,l.istilah_kelas,l.aktif,l.platform,
    (select count(*) from users x where x.lembaga_id=l.id and x.role='murid')::int murid,
    (select count(*) from users x where x.lembaga_id=l.id and x.role='guru')::int guru
  from lembaga l order by l.platform desc, l.id`.then(json));

// Buat lembaga baru sekaligus akun admin pertamanya
export const onRequestPost = guard(async ({ request }, _, sql) => {
  const b = await body(request);
  const kode = String(b.kode ?? '').trim().toLowerCase(), nama = String(b.nama ?? '').trim();
  const istilah = String(b.istilah_kelas ?? '').trim() || 'Kelas';
  const an = String(b.admin_nis ?? '').trim(), anama = String(b.admin_nama ?? '').trim() || 'Admin', apw = String(b.admin_password ?? '');
  if (!/^[a-z0-9-]{3,30}$/.test(kode)) throw bad('Kode lembaga 3-30 karakter: huruf kecil, angka, atau tanda hubung');
  if (kode === 'platform') throw bad('Kode "platform" dicadangkan');
  if (!nama) throw bad('Nama lembaga wajib diisi');
  if (!an) throw bad('Username admin lembaga wajib diisi');
  if (apw.length < 6) throw bad('Kata sandi admin minimal 6 karakter');
  if (apw.toLowerCase() === an.toLowerCase()) throw bad('Kata sandi admin tidak boleh sama dengan username');
  const [ada] = await sql`select 1 x from lembaga where kode=${kode}`;
  if (ada) throw bad('Kode lembaga sudah dipakai');
  const h = await hashPw(apw);
  await sql.transaction([
    sql`insert into lembaga(kode,nama,istilah_kelas) values(${kode},${nama},${istilah})`,
    sql`insert into users(lembaga_id,nis,nama,role,pass_hash) select id,${an},${anama},'admin',${h} from lembaga where kode=${kode}`
  ]);
  return json({ ok: true });
});

export const onRequestPut = guard(async ({ request }, _, sql) => {
  const id = qid(request), b = await body(request);
  const nama = String(b.nama ?? '').trim();
  if (!nama) throw bad('Nama lembaga wajib diisi');
  const r = await sql`update lembaga set nama=${nama}, istilah_kelas=${String(b.istilah_kelas ?? '').trim() || 'Kelas'},
    aktif = platform or ${b.aktif !== 'false' && b.aktif !== false} where id=${id} returning id`;
  if (!r.length) throw bad('Lembaga tidak ditemukan');
  return json({ ok: true });
});
