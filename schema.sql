-- Jalankan sekali di Neon SQL Editor
create table if not exists users(
  id serial primary key, nis text unique not null, nama text not null, kelas text not null default '',
  role text not null default 'murid' check (role in ('admin','murid')),
  pass_hash text not null, aktif boolean not null default true, created_at timestamptz default now());
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
