// Helper bersama untuk paket latihan (materi + soal pilihan ganda).
import { bad } from './core.js';

// Paket di lembaga user yang boleh diubah: admin semua, guru hanya buatannya sendiri.
export async function milik(sql, u, id) {
  const [p] = await sql`select id,judul,mapel,dibuat_oleh from paket
    where id=${id} and lembaga_id=${u.lembaga_id} and (${u.role}='admin' or dibuat_oleh=${u.id})`;
  if (!p) throw bad('Paket tidak ditemukan atau bukan buatan Anda');
  return p;
}

export const teks = (v, maks, nama) => {
  const s = String(v ?? '').trim();
  if (s.length > maks) throw bad(`${nama} terlalu panjang (maksimal ${maks} karakter)`);
  return s;
};
