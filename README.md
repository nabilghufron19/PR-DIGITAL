# PR Digital

Aplikasi tugas/PR untuk banyak lembaga (sekolah, madrasah, pesantren, bimbel). Tiap lembaga punya ruang data sendiri.
Satu kalimat: *guru mengatur tugas untuk kelas mana pun dalam hitungan detik, setor buku atau online, dan rekapnya otomatis.*

```
public/            -> situs statis (index.html, css/, js/)
functions/api/     -> API (Cloudflare Pages Functions): session, sandi, lembaga, guru, murid, soal, tugas, setor, pr, monitor
functions/_lib/    -> helper bersama (Neon, hash sandi, sesi cookie, pabrik endpoint akun)
schema.sql         -> skema database Neon (database baru)
migrasi.sql        -> migrasi dari versi lama (satu sekolah)
```

## Konsep
- **Lembaga**: satu ruang data terpisah. Login memakai *kode lembaga* + username + sandi. Istilah "Kelas" bisa diganti per lembaga (Rombel, Halaqah, ...).
- **Tiga peran**: `admin` (admin lembaga: kelola murid, guru, semua tugas), `guru` (kelola soal & tugas miliknya, lihat daftar murid), `murid`.
- **Admin platform**: admin dari lembaga berkode `platform`. Hanya dia yang punya tab *Lembaga* untuk membuat/menonaktifkan lembaga dan akun admin pertamanya.
- **Tugas hibrida**: tiap tugas punya cara pengumpulan — *Online* (murid mencentang sendiri) atau *Setor buku* (guru menandai saat buku diterima, satu ketukan per murid atau "terima semua").
- **Sasaran fleksibel**: tingkat, kelas/rombel, dan/atau murid tertentu (digabung). Kosong semua = semua murid aktif.
- **Rekap**: per tugas (mis. 18/30 sudah setor) dan per murid di tab Monitor; semuanya bisa diekspor ke Excel.

## Deploy
1. Neon: buat project, jalankan `schema.sql` di SQL Editor.
   (Sudah punya database dari versi lama? Jalankan `migrasi.sql`, bukan `schema.sql`. Seluruh data lama masuk ke lembaga berkode `sekolah`.)
2. Push repo ke GitHub, lalu Cloudflare Pages > Connect to Git.
   Framework: None, Build command: kosong, Output directory: `public`.
3. Settings > Variables and Secrets: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USER`, `ADMIN_PASS`.
4. Login pertama dengan kode lembaga **`platform`** + ADMIN_USER/ADMIN_PASS membuat akun admin platform otomatis. Setelah itu hapus ADMIN_PASS dari Variables.
5. Di tab *Lembaga*, buat lembaga beserta admin pertamanya, lalu bagikan kode lembaga + username + sandi awal.

## Lokal
`npm install`, salin `.dev.vars.example` ke `.dev.vars`, lalu `npm run dev`.

## Format Excel import
- Soal: `judul`, `mapel`, `isi`
- Murid: `nis`, `nama`, `kelas`, `tingkat` (opsional), `password` (opsional, kosong = NIS)
- Guru: `nis` (dipakai sebagai username), `nama`, `password` (opsional, kosong = username)

## Keamanan & perilaku
- Setiap request API dicek ke database: akun/lembaga yang dinonaktifkan atau dihapus langsung ditolak, dan ganti sandi membatalkan sesi lama.
- **Isolasi lembaga**: semua query data difilter `lembaga_id` dari sesi pengguna (bukan dari input), dan NIS hanya unik di dalam satu lembaga. Setiap endpoint yang menerima `id` juga mencocokkan lembaga.
- Guru hanya melihat/mengubah tugas dan soal buatannya sendiri; admin lembaga melihat semuanya di lembaganya.
- Login dibatasi 5 kali gagal per (lembaga + username), lalu terkunci 15 menit.
- Akun dengan sandi awal = NIS/username (atau direset admin) diminta membuat sandi baru saat login. Tombol 🔑 di pojok atas untuk ganti sandi kapan saja.
- Di Excel, format kolom `nis` sebagai Teks agar angka 0 di depan tidak hilang.
- Import murid/guru diproses 5 baris per permintaan karena hashing sandi berat di CPU Workers.
- "Terlambat" = tanggal tenggat (zona Asia/Jakarta) sudah lewat; tugas terjadwal belum dihitung di Monitor.
- Isi tugas disalin dari bank soal saat tugas dibuat: mengubah atau menghapus soal di bank tidak mengubah tugas yang sudah diberikan. Sasaran tugas tidak bisa diubah setelah dibuat (buat tugas baru untuk sasaran lain).
