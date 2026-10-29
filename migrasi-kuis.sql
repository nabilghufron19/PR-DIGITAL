-- Migrasi: tambah fitur KUIS (materi + soal pilihan ganda A-D) ke database yang sudah memakai versi multi-lembaga.
-- Jalankan SEKALI di Neon SQL Editor. Aman diulang (memakai if not exists). Data lama tidak disentuh.
-- Database baru (belum ada tabel apa pun): jalankan schema.sql saja, bukan file ini.
begin;

-- 1. Mode tugas bertambah satu: 'kuis'
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'tugas'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%mode%'
  loop
    execute format('alter table tugas drop constraint %I', r.conname);
  end loop;
end $$;
alter table tugas add constraint tugas_mode_check check (mode in ('online','setor','kuis'));

-- 2. Penugasan: nomor percobaan dan skor terbaik (khusus kuis)
alter table penugasan add column if not exists percobaan int not null default 1;
alter table penugasan add column if not exists skor_terbaik int;

-- 3. Paket latihan (materi + soal). Paket milik lembaga "platform" = template untuk semua lembaga.
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

-- 4. Soal milik tugas kuis + jawaban murid
create table if not exists tugas_soal(
  id serial primary key,
  tugas_id int not null references tugas(id) on delete cascade,
  lembaga_id int not null references lembaga(id) on delete cascade,
  urut int not null default 0,
  tanya text not null, a text not null, b text not null, c text not null, d text not null,
  kunci text not null check (kunci in ('a','b','c','d')),
  bahas text not null default '');
create index if not exists tugas_soal_tugas_idx on tugas_soal(tugas_id, urut);

create table if not exists jawaban(
  penugasan_id int not null references penugasan(id) on delete cascade,
  soal_id int not null references tugas_soal(id) on delete cascade,
  percobaan int not null,
  pilih text not null check (pilih in ('a','b','c','d')),
  benar boolean not null,
  dijawab_at timestamptz not null default now(),
  primary key (penugasan_id, soal_id, percobaan));
create index if not exists jawaban_soal_idx on jawaban(soal_id, percobaan);

commit;
