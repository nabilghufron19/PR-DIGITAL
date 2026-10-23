// Penjadwalan, penugasan, dan pencabutan soal (admin)
import { route, json } from '../_lib/core.js';
const A = ['admin'];

export const onRequestGet = route(A, (_, __, sql) => sql`
  select p.id,p.soal_id,s.judul,s.mapel,u.nis,u.nama,u.kelas,p.mulai,p.tenggat,p.status,p.selesai_at
  from penugasan p join soal s on s.id=p.soal_id join users u on u.id=p.user_id
  order by p.tenggat desc, u.nama limit 2000`.then(json));

// Tugaskan satu soal ke satu kelas (kelas kosong = semua murid aktif). Mulai di masa depan = terjadwal.
export const onRequestPost = route(A, async ({ request }, _, sql) => {
  const { soal_id, kelas = '', mulai = null, tenggat } = await request.json();
  if (!soal_id || !tenggat) throw new Error('Soal dan tenggat wajib diisi');
  const r = await sql`insert into penugasan(soal_id,user_id,mulai,tenggat)
    select ${soal_id}, id, coalesce(${mulai}::timestamptz, now()), ${tenggat}::timestamptz
    from users where role='murid' and aktif and (${kelas}='' or kelas=${kelas})
    on conflict (soal_id,user_id) do update set mulai=excluded.mulai, tenggat=excluded.tenggat, status='aktif'
    returning id`;
  return json({ ok: true, jumlah: r.length });
});

// Cabut / aktifkan kembali penugasan terpilih
export const onRequestPatch = route(A, async ({ request }, _, sql) => {
  const { ids = [], status } = await request.json();
  if (!['aktif', 'dicabut'].includes(status)) throw new Error('Status tidak valid');
  await sql`update penugasan set status=${status} where id = any(${ids.map(Number)})`;
  return json({ ok: true });
});
