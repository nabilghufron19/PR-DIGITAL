-- Untuk database yang sudah dibuat dengan schema.sql versi lama. Aman dijalankan berulang.
alter table users add column if not exists ganti_sandi boolean not null default false;
-- Jika baris ini gagal, ada NIS ganda beda huruf besar/kecil (mis. A1 dan a1): rapikan dulu datanya.
create unique index if not exists users_nis_lower_idx on users(lower(nis));
create table if not exists login_gagal(
  nis text primary key, gagal int not null default 0, terakhir timestamptz not null default now());
-- Catatan: murid lama yang sandinya masih NIS baru diminta ganti sandi setelah admin mengatur ulang sandinya di panel (otomatis wajib ganti).
