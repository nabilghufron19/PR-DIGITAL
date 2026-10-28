// Mode setoran: guru menandai murid yang sudah menyetor (satu ketukan per murid, atau banyak sekaligus)
import { route, json, bad, body } from '../_lib/core.js';

export const onRequestPost = route(['admin', 'guru'], async ({ request }, u, sql) => {
  const b = await body(request), selesai = b.selesai !== false && b.selesai !== 'false';
  const list = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Number.isInteger);
  if (!list.length) throw bad('Pilih murid dulu');
  if (list.length > 1000) throw bad('Terlalu banyak murid dalam satu permintaan');
  const r = await sql`update penugasan p set
      selesai_at = case when ${selesai}::boolean then coalesce(p.selesai_at, now()) else null end,
      ditandai_oleh = case when ${selesai}::boolean then coalesce(p.ditandai_oleh, 'guru') else null end
    from tugas t
    where t.id=p.tugas_id and p.id = any(${list}::int[]) and p.status='aktif'
      and t.lembaga_id=${u.lembaga_id} and (${u.role}='admin' or t.dibuat_oleh=${u.id})
    returning p.id`;
  return json({ ok: true, diubah: r.length });
});
