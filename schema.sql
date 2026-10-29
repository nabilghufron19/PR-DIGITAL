-- Jalankan sekali di Neon SQL Editor (database baru).
-- Database versi lama (satu sekolah, tanpa lembaga): jalankan migrasi.sql, bukan file ini.

-- Lembaga = satu "ruang data" (sekolah, madrasah, pesantren, bimbel, dst). Semua data lain terikat ke lembaga.
create table if not exists lembaga(
  id serial primary key,
  kode text not null unique check (kode ~ '^[a-z0-9-]{3,30}$'), -- dipakai saat login, selalu huruf kecil
  nama text not null,
  istilah_kelas text not null default 'Kelas', -- "Kelas", "Rombel", "Halaqah", dst
  aktif boolean not null default true,
  platform boolean not null default false, -- true = lembaga pemilik platform (admin-nya boleh membuat lembaga lain)
  created_at timestamptz default now());
create unique index if not exists lembaga_platform_idx on lembaga(platform) where platform;

create table if not exists users(
  id serial primary key,
  lembaga_id int not null references lembaga(id) on delete cascade,
  nis text not null, nama text not null,
  kelas text not null default '',   -- nama kelompok bebas: "XI RPL 1", "Kelas 7A", "Bimbel UTBK Sore"
  tingkat text not null default '', -- label tingkat opsional untuk pengelompokan: "7", "XI", dst
  role text not null default 'murid' check (role in ('admin','guru','murid')),
  pass_hash text not null, aktif boolean not null default true,
  ganti_sandi boolean not null default false, -- true = wajib ganti sandi saat login
  created_at timestamptz default now());
create unique index if not exists users_lembaga_nis_idx on users(lembaga_id, lower(nis));
create index if not exists users_lembaga_role_idx on users(lembaga_id, role);

-- Bank soal: kumpulan bahan yang bisa dipakai ulang saat membuat tugas
create table if not exists soal(
  id serial primary key,
  lembaga_id int not null references lembaga(id) on delete cascade,
  judul text not null, mapel text not null, isi text not null,
  dibuat_oleh int references users(id) on delete set null, created_at timestamptz default now());
create index if not exists soal_lembaga_idx on soal(lembaga_id);

-- Tugas = satu pemberian tugas ke satu sasaran. Isinya disalin dari bank soal (atau ditulis langsung),
-- jadi mengubah/menghapus soal di bank tidak mengubah tugas yang sudah diberikan.
create table if not exists tugas(
  id serial primary key,
  lembaga_id int not null references lembaga(id) on delete cascade,
  soal_id int references soal(id) on delete set null,
  judul text not null, mapel text not null, isi text not null,
  mode text not null default 'online' check (mode in ('online','setor','kuis')), -- online: murid mencentang sendiri; setor: guru menandai saat buku diterima; kuis: murid membaca materi lalu menjawab soal pilihan ganda
  mulai timestamptz not null default now(), tenggat timestamptz not null,
  sasaran text not null default '', -- ringkasan sasaran untuk ditampilkan, mis. "XI RPL 1" atau "3 murid"
  dibuat_oleh int references users(id) on delete set null,
  created_at timestamptz default now());
create index if not exists tugas_lembaga_idx on tugas(lembaga_id, tenggat);

-- Penugasan = satu baris per murid untuk setiap tugas
create table if not exists penugasan(
  id serial primary key,
  tugas_id int not null references tugas(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  lembaga_id int not null references lembaga(id) on delete cascade,
  status text not null default 'aktif' check (status in ('aktif','dicabut')),
  selesai_at timestamptz,
  ditandai_oleh text check (ditandai_oleh in ('murid','guru')),
  percobaan int not null default 1, -- khusus kuis: nomor percobaan yang sedang berjalan
  skor_terbaik int,                 -- khusus kuis: jumlah benar terbanyak dari semua percobaan yang diselesaikan
  unique (tugas_id, user_id));
create index if not exists penugasan_user_idx on penugasan(user_id, status);

-- Paket latihan = satu materi + beberapa soal pilihan ganda A-D (dibuat admin/guru per lembaga).
-- Paket milik lembaga berkode "platform" otomatis menjadi TEMPLATE yang bisa disalin lembaga mana pun.
create table if not exists paket(
  id serial primary key,
  lembaga_id int not null references lembaga(id) on delete cascade,
  judul text not null, mapel text not null, materi text not null,
  dibuat_oleh int references users(id) on delete set null, created_at timestamptz default now());
create index if not exists paket_lembaga_idx on paket(lembaga_id);

create table if not exists paket_soal(
  id serial primary key,
  paket_id int not null references paket(id) on delete cascade,
  lembaga_id int not null references lembaga(id) on delete cascade,
  urut int not null default 0,
  tanya text not null, a text not null, b text not null, c text not null, d text not null,
  kunci text not null check (kunci in ('a','b','c','d')),
  bahas text not null default '');
create index if not exists paket_soal_paket_idx on paket_soal(paket_id, urut);

-- Soal milik satu tugas kuis: disalin dari paket saat tugas dibuat (mengubah paket tidak mengubah tugas yang sudah berjalan).
-- Materi bacaan disimpan di tugas.isi.
create table if not exists tugas_soal(
  id serial primary key,
  tugas_id int not null references tugas(id) on delete cascade,
  lembaga_id int not null references lembaga(id) on delete cascade,
  urut int not null default 0,
  tanya text not null, a text not null, b text not null, c text not null, d text not null,
  kunci text not null check (kunci in ('a','b','c','d')),
  bahas text not null default '');
create index if not exists tugas_soal_tugas_idx on tugas_soal(tugas_id, urut);

-- Jawaban murid per percobaan. Satu soal hanya bisa dijawab sekali per percobaan; jawaban pertama yang berlaku.
create table if not exists jawaban(
  penugasan_id int not null references penugasan(id) on delete cascade,
  soal_id int not null references tugas_soal(id) on delete cascade,
  percobaan int not null,
  pilih text not null check (pilih in ('a','b','c','d')),
  benar boolean not null,
  dijawab_at timestamptz not null default now(),
  primary key (penugasan_id, soal_id, percobaan));
create index if not exists jawaban_soal_idx on jawaban(soal_id, percobaan);

-- Pembatas percobaan login (kunci = "kode_lembaga:username")
create table if not exists login_gagal(
  nis text primary key, gagal int not null default 0, terakhir timestamptz not null default now());
