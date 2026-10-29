// Soal pilihan ganda di dalam paket (tambah / import banyak sekaligus / ubah / hapus). Admin & guru pemilik paket.
import { route, json, bad, body, qid } from '../_lib/core.js';
import { milik } from '../_lib/paket.js';
const R = ['admin', 'guru'];
const MAKS_PER_PAKET = 100, MAKS_PER_REQ = 100;

// Satu baris soal -> objek bersih, atau null bila tidak lengkap/tidak valid
const baris = x => {
  const t = k => String(x?.[k] ?? '').trim();
  const kunci = /^[\s(]*([a-d])[\s.)]*$/i.exec(String(x?.kunci ?? ''))?.[1]?.toLowerCase();
  const r = { tanya: t('tanya'), a: t('a'), b: t('b'), c: t('c'), d: t('d'), kunci, bahas: t('bahas') };
  if (!r.tanya || !r.a || !r.b || !r.c || !r.d || !kunci) return null;
  if (r.tanya.length > 1000 || [r.a, r.b, r.c, r.d].some(o => o.length > 300) || r.bahas.length > 1000) return null;
  return r;
};

export const onRequestPost = route(R, async ({ request }, u, sql) => {
  const b = await body(request), pid = +b.paket_id;
  if (!Number.isInteger(pid) || pid < 1) throw bad('Paket tidak valid');
  await milik(sql, u, pid);
  const list = Array.isArray(b.soal) ? b.soal : [b];
  if (list.length > MAKS_PER_REQ) throw bad(`Maksimal ${MAKS_PER_REQ} soal per permintaan`);
  const rows = list.map(baris).filter(Boolean);
  if (!rows.length && !Array.isArray(b.soal)) throw bad('Pertanyaan, opsi A-D, dan kunci (A/B/C/D) wajib diisi dengan benar');
  if (!rows.length) return json({ ok: true, dibuat: 0, dilewati: list.length }); // import: tidak ada baris valid, biarkan klien yang melaporkan
  const [{ n, mx }] = await sql`select count(*)::int n, coalesce(max(urut),0)::int mx from paket_soal where paket_id=${pid}`;
  if (n + rows.length > MAKS_PER_PAKET) throw bad(`Satu paket maksimal ${MAKS_PER_PAKET} soal`);
  await sql.transaction(rows.map((r, i) => sql`
    insert into paket_soal(paket_id,lembaga_id,urut,tanya,a,b,c,d,kunci,bahas)
    values(${pid},${u.lembaga_id},${mx + i + 1},${r.tanya},${r.a},${r.b},${r.c},${r.d},${r.kunci},${r.bahas})`));
  return json({ ok: true, dibuat: rows.length, dilewati: list.length - rows.length });
});

export const onRequestPut = route(R, async ({ request }, u, sql) => {
  const id = qid(request), r = baris(await body(request));
  if (!r) throw bad('Pertanyaan, opsi A-D, dan kunci (A/B/C/D) wajib diisi dengan benar');
  const x = await sql`update paket_soal s set tanya=${r.tanya}, a=${r.a}, b=${r.b}, c=${r.c}, d=${r.d}, kunci=${r.kunci}, bahas=${r.bahas}
    from paket p where s.id=${id} and s.lembaga_id=${u.lembaga_id} and p.id=s.paket_id and (${u.role}='admin' or p.dibuat_oleh=${u.id})
    returning s.id`;
  if (!x.length) throw bad('Soal tidak ditemukan atau bukan buatan Anda');
  return json({ ok: true });
});

export const onRequestDelete = route(R, async ({ request }, u, sql) => {
  const x = await sql`delete from paket_soal s using paket p
    where s.id=${qid(request)} and s.lembaga_id=${u.lembaga_id} and p.id=s.paket_id and (${u.role}='admin' or p.dibuat_oleh=${u.id})
    returning s.id`;
  if (!x.length) throw bad('Soal tidak ditemukan atau bukan buatan Anda');
  return json({ ok: true });
});
