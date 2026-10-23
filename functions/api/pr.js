// Sisi murid: daftar PR aktif milik sendiri + tandai selesai
import { route, json } from '../_lib/core.js';

export const onRequestGet = route(['murid'], (_, u, sql) => sql`
  select p.id, s.judul title, s.mapel subject, s.isi,
    to_char(p.tenggat at time zone 'Asia/Jakarta','YYYY-MM-DD') due, (p.selesai_at is not null) done
  from penugasan p join soal s on s.id=p.soal_id
  where p.user_id=${u.id} and p.status='aktif' and p.mulai<=now()
  order by done, p.tenggat`.then(json));

export const onRequestPost = route(['murid'], async ({ request }, u, sql) => {
  const { id } = await request.json();
  await sql`update penugasan set selesai_at = case when selesai_at is null then now() else null end
    where id=${id} and user_id=${u.id} and status='aktif' and mulai<=now()`;
  return json({ ok: true });
});
