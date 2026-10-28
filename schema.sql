-- Jalankan sekali di Neon SQL Editor (database baru).
-- Database lama: jalankan migrasi.sql, bukan file ini.
create table if not exists users(
  id serial primary key, nis text not null, nama text not null, kelas text not null default '',
  role text not null default 'murid' check (role in ('admin','murid')),
  pass_hash text not null, aktif boolean not null default true,
  ganti_sandi boolean not null default false, -- true = wajib ganti sandi saat login
  created_at timestamptz default now());
create unique index if not exists users_nis_lower_idx on users(lower(nis));
create table if not exists soal(
  id serial primary key, judul text not null, mapel text not null, isi text not null,
  dibuat_oleh int references users(id) on delete set null, created_at timestamptz default now());
create table if not exists penugasan(
  id serial primary key,
  soal_id int not null references soal(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  mulai timestamptz not null default now(), tenggat timestamptz not null,
  status text not null default 'aktif' check (status in ('aktif','dicabut')),
  selesai_at timestamptz, unique (soal_id, user_id));
create index if not exists penugasan_user_idx on penugasan(user_id, status);
-- Pembatas percobaan login
create table if not exists login_gagal(
  nis text primary key, gagal int not null default 0, terakhir timestamptz not null default now());
