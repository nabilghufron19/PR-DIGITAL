// Pabrik endpoint akun untuk satu peran (murid / guru). Semua query terikat ke lembaga admin yang sedang login.
// Import: upsert per NIS/username, sandi awal = NIS bila kolom password kosong (wajib diganti saat login pertama).
import { route, json, bad, body, qid, hashPw } from './core.js';
const MAX_BARIS = 10; // PBKDF2 berat di CPU Workers: batasi jumlah hash per request

export function akun(role, bacaRoles = ['admin']) {
  const A = ['admin'];
  const onRequestGet = route(bacaRoles, (_, u, sql) => sql`
    select id,nis,nama,kelas,tingkat,aktif from users
    where role=${role} and lembaga_id=${u.lembaga_id} order by kelas,nama`.then(json));

  const onRequestPost = route(A, async ({ request }, u, sql) => {
    const b = await body(request), list = Array.isArray(b) ? b : [b];
    if (list.length > MAX_BARIS) throw bad(`Maksimal ${MAX_BARIS} data per permintaan`);
    const rows = list.map(x => {
      const pwIn = String(x.password ?? '').trim(), nis = String(x.nis ?? '').trim();
      return { nis, nama: String(x.nama ?? '').trim(), kelas: String(x.kelas ?? '').trim(), tingkat: String(x.tingkat ?? '').trim(), pw: pwIn || nis, wajib: !pwIn };
    }).filter(r => r.nis && r.nama);
    if (!rows.length) throw bad('NIS/username dan nama wajib diisi');
    const hs = await Promise.all(rows.map(r => hashPw(r.pw)));
    // NIS dibandingkan tanpa membedakan huruf besar/kecil, hanya di dalam lembaga ini; akun peran lain tidak pernah ditimpa
    const res = await sql.transaction(rows.map((r, i) => sql`
      insert into users(lembaga_id,role,nis,nama,kelas,tingkat,pass_hash,ganti_sandi)
      values(${u.lembaga_id},${role},${r.nis},${r.nama},${r.kelas},${r.tingkat},${hs[i]},${r.wajib})
      on conflict (lembaga_id, (lower(nis))) do update set nama=excluded.nama, kelas=excluded.kelas, tingkat=excluded.tingkat
        where users.role=${role}
      returning id`));
    const dibuat = res.filter(x => x.length).length;
    return json({ ok: true, dibuat, dilewati: list.length - dibuat });
  });

  const onRequestPut = route(A, async ({ request }, u, sql) => {
    const id = qid(request), b = await body(request);
    const nama = String(b.nama || '').trim();
    if (!nama) throw bad('Nama wajib diisi');
    const h = b.password ? await hashPw(String(b.password)) : null;
    const r = await sql`update users set nama=${nama}, kelas=${String(b.kelas || '').trim()}, tingkat=${String(b.tingkat || '').trim()},
      aktif=${b.aktif !== 'false' && b.aktif !== false},
      pass_hash=coalesce(${h}::text, pass_hash), ganti_sandi = ganti_sandi or ${!!h}
      where id=${id} and role=${role} and lembaga_id=${u.lembaga_id} returning id`;
    if (!r.length) throw bad('Data tidak ditemukan');
    return json({ ok: true });
  });

  const onRequestDelete = route(A, async ({ request }, u, sql) => {
    await sql`delete from users where id=${qid(request)} and role=${role} and lembaga_id=${u.lembaga_id}`;
    return json({ ok: true });
  });

  return { onRequestGet, onRequestPost, onRequestPut, onRequestDelete };
}
