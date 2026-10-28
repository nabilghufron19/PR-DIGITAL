# PR Digital

```
public/            -> situs statis (index.html, css/, js/)
functions/api/     -> API (Cloudflare Pages Functions): session, sandi, soal, murid, tugas, monitor, pr
functions/_lib/    -> helper bersama (Neon, hash sandi, sesi cookie)
schema.sql         -> skema database Neon
```

## Deploy
1. Neon: buat project, jalankan `schema.sql` di SQL Editor.
   (Sudah punya database dari versi lama? Jalankan `migrasi.sql`, bukan `schema.sql`.)
2. Push repo ke GitHub, lalu Cloudflare Pages > Connect to Git.
   Framework: None, Build command: kosong, Output directory: `public`.
3. Settings > Variables and Secrets: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USER`, `ADMIN_PASS`.
4. Login pertama dengan ADMIN_USER/ADMIN_PASS membuat akun admin otomatis. Setelah itu hapus ADMIN_PASS dari Variables.

## Lokal
`npm install`, salin `.dev.vars.example` ke `.dev.vars`, lalu `npm run dev`.

## Format Excel import
- Soal: `judul`, `mapel`, `isi`
- Murid: `nis`, `nama`, `kelas`, `password` (opsional, kosong = NIS)

## Keamanan & perilaku
- Setiap request API dicek ke database: akun yang dinonaktifkan/dihapus langsung ditolak, dan ganti sandi membatalkan sesi lama.
- Login dibatasi 5 kali gagal per username, lalu terkunci 15 menit.
- Murid yang sandi awalnya = NIS (atau direset admin) diminta membuat sandi baru saat login. Tombol 🔑 di pojok atas untuk ganti sandi kapan saja.
- Di Excel, format kolom `nis` sebagai Teks agar angka 0 di depan tidak hilang.
- Import murid diproses 5 baris per permintaan karena hashing sandi berat di CPU Workers.
- "Terlambat" = tanggal tenggat (zona Asia/Jakarta) sudah lewat; PR terjadwal belum dihitung di Monitor.
- Menugaskan ulang soal yang sama ke murid yang sama = mengulang (status selesai direset).
