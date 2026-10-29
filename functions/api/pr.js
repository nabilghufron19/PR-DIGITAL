// Sisi murid: daftar PR aktif milik sendiri + tandai selesai (hanya untuk tugas mode online; kuis lewat kuis.js)
import { route, json, bad, body } from '../_lib/core.js';

// diff = selisih hari (zona Asia/Jakarta) antara tanggal tenggat dan hari ini; sama dengan hitungan "terlambat" di Monitor
export const onRequestGet = route(['murid'], (_, u, sql) => sql`
  select p.id, t.judul title, t.mapel subject, t.isi, t.mode,
    to_char(t.tenggat at time zone 'Asia/Jakarta','YYYY-MM-DD') due,
    ((t.tenggat at time zone 'Asia/Jakarta')::date - (now() at time zone 'Asia/Jakarta')::date) diff,
    (p.selesai_at is not null) done,
    p.skor_terbaik skor, (select count(*) from tugas_soal s where s.tugas_id=t.id)::int nsoal
  from penugasan p join tugas t on t.id=p.tugas_id
  where p.user_id=${u.id} and p.status='aktif' and t.mulai<=now()
  order by done, t.tenggat`.then(json));

export const onRequestPost = route(['murid'], async ({ request }, u, sql) => {
  const id = +(await body(request)).id;
  if (!Number.isInteger(id)) throw bad('ID tidak valid');
  // Mode "setor" hanya bisa ditandai guru; tanda dari guru tidak bisa dibatalkan murid
  const r = await sql`update penugasan p set
      selesai_at = case when p.selesai_at is null then now() else null end,
      ditandai_oleh = case when p.selesai_at is null then 'murid' else null end
    from tugas t
    where t.id=p.tugas_id and p.id=${id} and p.user_id=${u.id} and p.status='aktif' and t.mulai<=now() and t.mode='online'
      and (p.selesai_at is null or p.ditandai_oleh is distinct from 'guru')
    returning p.id`;
  if (!r.length) throw bad('PR ini tidak bisa dicentang sendiri. Setor langsung ke guru ya.');
  return json({ ok: true });
});
