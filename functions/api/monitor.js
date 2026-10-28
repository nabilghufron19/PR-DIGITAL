import { route, json } from '../_lib/core.js';

// Hanya PR yang sudah tampil bagi murid (mulai <= sekarang) yang dihitung. Terlambat = tanggal tenggat (Jakarta) sudah lewat.
// Admin melihat seluruh tugas di lembaganya; guru hanya tugas buatannya sendiri.
export const onRequestGet = route(['admin', 'guru'], async (_, u, sql) => {
  const murid = await sql`
    select x.id,x.nis,x.nama,x.kelas,
      count(p.id) filter (where t.id is not null and p.status='aktif' and t.mulai<=now())::int total,
      count(p.id) filter (where t.id is not null and p.status='aktif' and t.mulai<=now() and p.selesai_at is not null)::int selesai,
      count(p.id) filter (where t.id is not null and p.status='aktif' and t.mulai<=now() and p.selesai_at is null
        and (t.tenggat at time zone 'Asia/Jakarta')::date < (now() at time zone 'Asia/Jakarta')::date)::int terlambat
    from users x
    left join penugasan p on p.user_id=x.id
    left join tugas t on t.id=p.tugas_id and (${u.role}='admin' or t.dibuat_oleh=${u.id})
    where x.role='murid' and x.aktif and x.lembaga_id=${u.lembaga_id}
    group by x.id order by x.kelas,x.nama`;
  const [t] = await sql`select (select count(*) from soal where lembaga_id=${u.lembaga_id})::int soal,
    (select count(*) from tugas where lembaga_id=${u.lembaga_id} and mulai>now() and (${u.role}='admin' or dibuat_oleh=${u.id}))::int terjadwal`;
  return json({ murid, ...t });
});
