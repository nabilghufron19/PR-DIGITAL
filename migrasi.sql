-- Migrasi dari versi lama (satu sekolah) ke versi multi-lembaga + tugas hibrida.
-- Jalankan SEKALI di Neon SQL Editor. Seluruh data lama dipertahankan:
--   * semua akun, soal, dan penugasan lama masuk ke satu lembaga bernama "Lembaga Saya" (kode: sekolah)
--   * tiap kelompok penugasan lama (soal + jadwal yang sama) menjadi satu "tugas" bermode online
-- Setelah itu murid/guru login dengan kode lembaga "sekolah". Silakan ubah nama & kode lewat panel Platform.
-- Dianjurkan dibungkus transaksi; jika gagal di tengah jalan, tidak ada yang berubah.
begin;

create table if not exists lembaga(
  id serial primary key,
  kode text not null unique check (kode ~ '^[a-z0-9-]{3,30}$'),
  nama text not null,
  istilah_kelas text not null default 'Kelas',
  aktif boolean not null default true,
  platform boolean not null default false,
  created_at timestamptz default now());
create unique index if not exists lembaga_platform_idx on lembaga(platform) where platform;
insert into lembaga(kode, nama) values('sekolah', 'Lembaga Saya') on conflict (kode) do nothing;

-- users
alter table users add column if not exists lembaga_id int references lembaga(id) on delete cascade;
alter table users add column if not exists tingkat text not null default '';
update users set lembaga_id = (select id from lembaga where kode = 'sekolah') where lembaga_id is null;
alter table users alter column lembaga_id set not null;
drop index if exists users_nis_lower_idx;
-- Versi lama membuat NIS unik di seluruh database (constraint users_nis_key). Harus dilepas agar NIS yang sama boleh dipakai di lembaga berbeda.
alter table users drop constraint if exists users_nis_key;
create unique index if not exists users_lembaga_nis_idx on users(lembaga_id, lower(nis));
create index if not exists users_lembaga_role_idx on users(lembaga_id, role);
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('admin','guru','murid'));

-- soal
alter table soal add column if not exists lembaga_id int references lembaga(id) on delete cascade;
update soal set lembaga_id = (select id from lembaga where kode = 'sekolah') where lembaga_id is null;
alter table soal alter column lembaga_id set not null;
create index if not exists soal_lembaga_idx on soal(lembaga_id);

-- tugas (baru)
create table if not exists tugas(
  id serial primary key,
  lembaga_id int not null references lembaga(id) on delete cascade,
  soal_id int references soal(id) on delete set null,
  judul text not null, mapel text not null, isi text not null,
  mode text not null default 'online' check (mode in ('online','setor')),
  mulai timestamptz not null default now(), tenggat timestamptz not null,
  sasaran text not null default '',
  dibuat_oleh int references users(id) on delete set null,
  created_at timestamptz default now());
create index if not exists tugas_lembaga_idx on tugas(lembaga_id, tenggat);

-- penugasan: ubah dari (soal, murid) menjadi (tugas, murid), hanya jika masih berbentuk lama
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = current_schema() and table_name = 'penugasan' and column_name = 'soal_id') then
    insert into tugas(lembaga_id, soal_id, judul, mapel, isi, mode, mulai, tenggat, sasaran, dibuat_oleh)
      select distinct s.lembaga_id, s.id, s.judul, s.mapel, s.isi, 'online', p.mulai, p.tenggat, 'Data lama', s.dibuat_oleh
      from penugasan p join soal s on s.id = p.soal_id;
    alter table penugasan add column tugas_id int references tugas(id) on delete cascade;
    alter table penugasan add column lembaga_id int references lembaga(id) on delete cascade;
    alter table penugasan add column ditandai_oleh text check (ditandai_oleh in ('murid','guru'));
    update penugasan p set tugas_id = t.id
      from tugas t where t.soal_id = p.soal_id and t.mulai = p.mulai and t.tenggat = p.tenggat and t.sasaran = 'Data lama';
    update penugasan p set lembaga_id = u.lembaga_id from users u where u.id = p.user_id;
    update penugasan set ditandai_oleh = 'murid' where selesai_at is not null;
    alter table penugasan alter column tugas_id set not null;
    alter table penugasan alter column lembaga_id set not null;
    alter table penugasan drop column soal_id;
    alter table penugasan drop column mulai;
    alter table penugasan drop column tenggat;
    alter table penugasan add constraint penugasan_tugas_user_key unique (tugas_id, user_id);
    create index if not exists penugasan_user_idx on penugasan(user_id, status);
  end if;
end $$;

-- pembatas login: kunci sekarang "kode_lembaga:username"; catatan lama tidak berlaku lagi
delete from login_gagal;

commit;
-- Catatan: untuk membuat akun pemilik platform (membuat lembaga lain), pastikan ADMIN_USER dan ADMIN_PASS
-- masih terisi di Variables, lalu login dengan kode lembaga "platform". Setelah itu hapus ADMIN_PASS.
