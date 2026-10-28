import { route, json } from '../_lib/core.js';

// Hanya PR yang sudah tampil bagi murid (mulai <= sekarang) yang dihitung. Terlambat = tanggal tenggat (Jakarta) sudah lewat.
export const onRequestGet = route(['admin'], async (_, __, sql) => {
  const murid = await sql`
    select u.id,u.nis,u.nama,u.kelas,
      count(p.id) filter (where p.status='aktif' and p.mulai<=now())::int total,
      count(p.id) filter (where p.status='aktif' and p.mulai<=now() and p.selesai_at is not null)::int selesai,
      count(p.id) filter (where p.status='aktif' and p.mulai<=now() and p.selesai_at is null
        and (p.tenggat at time zone 'Asia/Jakarta')::date < (now() at time zone 'Asia/Jakarta')::date)::int terlambat
    from users u left join penugasan p on p.user_id=u.id
    where u.role='murid' and u.aktif group by u.id order by u.kelas,u.nama`;
  const [t] = await sql`select (select count(*) from soal)::int soal,
    (select count(*) from penugasan where status='aktif' and mulai>now())::int terjadwal`;
  return json({ murid, ...t });
});
