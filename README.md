# PR Digital

```
public/            -> situs statis (index.html, css/, js/)
functions/api/     -> API (Cloudflare Pages Functions): session, soal, murid, tugas, monitor, pr
functions/_lib/    -> helper bersama (Neon, hash sandi, sesi cookie)
schema.sql         -> skema database Neon
```

## Deploy
1. Neon: buat project, jalankan `schema.sql` di SQL Editor.
2. Push repo ke GitHub, lalu Cloudflare Pages > Connect to Git.
   Framework: None, Build command: kosong, Output directory: `public`.
3. Settings > Variables and Secrets: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USER`, `ADMIN_PASS`.
4. Login pertama dengan ADMIN_USER/ADMIN_PASS membuat akun admin otomatis. Setelah itu hapus ADMIN_PASS dari Variables.

## Lokal
`npm install`, salin `.dev.vars.example` ke `.dev.vars`, lalu `npm run dev`.

## Format Excel import
- Soal: `judul`, `mapel`, `isi`
- Murid: `nis`, `nama`, `kelas`, `password` (opsional, kosong = NIS)
