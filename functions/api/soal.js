// Bank soal. Admin & guru. Guru hanya boleh mengubah/menghapus soal buatannya sendiri; admin boleh semua di lembaganya.
import { route, json, bad, body, qid } from '../_lib/core.js';
const R = ['admin', 'guru'];
const row = b => [String(b.judul ?? '').trim(), String(b.mapel ?? '').trim(), String(b.isi ?? '').trim()];

export const onRequestGet = route(R, (_, u, sql) => sql`
  select s.id,s.judul,s.mapel,s.isi,s.created_at,s.dibuat_oleh,p.nama pembuat
  from soal s left join users p on p.id=s.dibuat_oleh
  where s.lembaga_id=${u.lembaga_id} order by s.id desc`.then(json));
export const onRequestPost = route(R, async ({ request }, u, sql) => {
  const b = await body(request), list = Array.isArray(b) ? b : [b];
  if (list.length > 100) throw bad('Maksimal 100 soal per permintaan');
  const rows = list.map(row).filter(r => r[0] && r[1] && r[2]);
  if (!rows.length) throw bad('Judul, mapel, dan isi wajib diisi');
  await sql.transaction(rows.map(r => sql`insert into soal(lembaga_id,judul,mapel,isi,dibuat_oleh) values(${u.lembaga_id},${r[0]},${r[1]},${r[2]},${u.id})`));
  return json({ ok: true, dibuat: rows.length, dilewati: list.length - rows.length });
});
export const onRequestPut = route(R, async ({ request }, u, sql) => {
  const id = qid(request), [judul, mapel, isi] = row(await body(request));
  if (!judul || !mapel || !isi) throw bad('Judul, mapel, dan isi wajib diisi');
  const r = await sql`update soal set judul=${judul}, mapel=${mapel}, isi=${isi}
    where id=${id} and lembaga_id=${u.lembaga_id} and (${u.role}='admin' or dibuat_oleh=${u.id}) returning id`;
  if (!r.length) throw bad('Soal tidak ditemukan atau bukan buatan Anda');
  return json({ ok: true });
});
export const onRequestDelete = route(R, async ({ request }, u, sql) => {
  // tugas yang sudah dibuat dari soal ini tetap ada (isinya sudah disalin)
  const r = await sql`delete from soal where id=${qid(request)} and lembaga_id=${u.lembaga_id} and (${u.role}='admin' or dibuat_oleh=${u.id}) returning id`;
  if (!r.length) throw bad('Soal tidak ditemukan atau bukan buatan Anda');
  return json({ ok: true });
});
