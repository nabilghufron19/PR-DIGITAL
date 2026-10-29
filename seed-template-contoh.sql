-- Contoh TEMPLATE paket kuis (IPA dan Matematika) di lembaga "platform".
-- Paket milik lembaga platform otomatis tampil sebagai template untuk semua lembaga:
-- admin/guru tinggal klik  Soal > Paket kuis > "Pakai template"  lalu mengubahnya sesuai kebutuhan.
--
-- Cara menambah template sendiri, ada dua pilihan:
--   1) Login sebagai Admin Platform > tab Soal > Paket kuis. Buat paket, tulis materi, tambah soal satu per satu atau import Excel.
--   2) Salin pola file ini (satu blok per paket). Teks panjang ditulis di antara $m$ ... $m$ supaya tanda kutip aman.
-- Aman dijalankan ulang: paket dengan judul yang sama di platform diganti.
begin;

insert into lembaga(kode, nama, platform) values ('platform', 'Platform', true) on conflict (kode) do nothing;
delete from paket where lembaga_id = (select id from lembaga where platform)
  and judul in ('Sistem Pencernaan Manusia', 'Penjumlahan dan Pengurangan Pecahan');

-- ====================== IPA: Sistem Pencernaan Manusia ======================
with p as (
  insert into paket(lembaga_id, judul, mapel, materi)
  select id, 'Sistem Pencernaan Manusia', 'IPA', $m$Sistem pencernaan mengolah makanan menjadi zat sederhana yang dapat diserap tubuh. Prosesnya dibagi dua: pencernaan mekanik (makanan dihaluskan oleh gigi dan gerakan otot) dan pencernaan kimiawi (makanan dipecah oleh enzim).

Pencernaan dimulai di mulut. Gigi mengunyah makanan, sedangkan air liur mengandung enzim amilase yang mengubah amilum (pati) menjadi gula sederhana. Makanan yang sudah dikunyah ditelan, lalu melewati kerongkongan menuju lambung.

Di lambung, makanan diaduk dan dicampur dengan asam lambung serta enzim pepsin yang mulai memecah protein. Setelah itu makanan masuk ke usus halus. Di sini hati menghasilkan empedu yang membantu mencerna lemak, dan pankreas menghasilkan enzim untuk memecah karbohidrat, protein, dan lemak. Sari-sari makanan diserap oleh dinding usus halus, lalu diedarkan ke seluruh tubuh oleh darah.

Sisa makanan yang tidak dicerna masuk ke usus besar. Usus besar menyerap air, kemudian sisanya dikeluarkan sebagai feses melalui anus.$m$
  from lembaga where platform returning id, lembaga_id)
insert into paket_soal(paket_id, lembaga_id, urut, tanya, a, b, c, d, kunci, bahas)
select p.id, p.lembaga_id, v.urut, v.tanya, v.a, v.b, v.c, v.d, v.kunci, v.bahas
from p, (values
  (1, 'Enzim dalam air liur yang mengubah amilum menjadi gula sederhana disebut...', 'Pepsin', 'Amilase', 'Lipase', 'Empedu', 'b', 'Lihat paragraf 2: air liur mengandung enzim amilase.'),
  (2, 'Pencernaan protein mulai terjadi di...', 'Mulut', 'Lambung', 'Usus besar', 'Kerongkongan', 'b', 'Lihat paragraf 3: enzim pepsin di lambung mulai memecah protein.'),
  (3, 'Organ yang menghasilkan empedu adalah...', 'Pankreas', 'Lambung', 'Hati', 'Usus halus', 'c', 'Lihat paragraf 3: hati menghasilkan empedu yang membantu mencerna lemak.'),
  (4, 'Sari-sari makanan diserap terutama oleh dinding...', 'Lambung', 'Usus halus', 'Usus besar', 'Kerongkongan', 'b', 'Lihat paragraf 3: sari makanan diserap oleh dinding usus halus.'),
  (5, 'Fungsi utama usus besar adalah...', 'Menyerap air dari sisa makanan', 'Menghasilkan empedu', 'Memecah protein', 'Mengunyah makanan', 'a', 'Lihat paragraf 4: usus besar menyerap air dari sisa makanan.')
) as v(urut, tanya, a, b, c, d, kunci, bahas);

-- ====================== Matematika: Penjumlahan dan Pengurangan Pecahan ======================
with p as (
  insert into paket(lembaga_id, judul, mapel, materi)
  select id, 'Penjumlahan dan Pengurangan Pecahan', 'Matematika', $m$Pecahan ditulis dalam bentuk a/b. Bilangan a disebut pembilang dan b disebut penyebut. Penyebut tidak boleh nol.

Menjumlahkan atau mengurangkan pecahan yang penyebutnya sama sangat mudah: jumlahkan atau kurangkan pembilangnya, sedangkan penyebutnya tetap. Contoh: 2/7 + 3/7 = 5/7, dan 5/7 - 3/7 = 2/7.

Jika penyebutnya berbeda, samakan dulu penyebutnya dengan mencari KPK (Kelipatan Persekutuan Terkecil) dari kedua penyebut. Contoh: 1/2 + 1/3. KPK dari 2 dan 3 adalah 6. Ubah 1/2 menjadi 3/6 dan 1/3 menjadi 2/6, sehingga 1/2 + 1/3 = 3/6 + 2/6 = 5/6.

Hasil akhir sebaiknya disederhanakan dengan membagi pembilang dan penyebut dengan FPB (Faktor Persekutuan Terbesar) keduanya. Contoh: 4/8 disederhanakan menjadi 1/2 karena FPB dari 4 dan 8 adalah 4.$m$
  from lembaga where platform returning id, lembaga_id)
insert into paket_soal(paket_id, lembaga_id, urut, tanya, a, b, c, d, kunci, bahas)
select p.id, p.lembaga_id, v.urut, v.tanya, v.a, v.b, v.c, v.d, v.kunci, v.bahas
from p, (values
  (1, 'Hasil dari 2/9 + 5/9 adalah...', '7/18', '7/9', '3/9', '10/9', 'b', 'Penyebut sama, jadi jumlahkan pembilangnya: 2 + 5 = 7, penyebut tetap 9.'),
  (2, 'KPK dari 4 dan 6 adalah...', '10', '24', '12', '2', 'c', 'Kelipatan 4: 4, 8, 12, ... Kelipatan 6: 6, 12, ... Kelipatan persekutuan terkecilnya 12.'),
  (3, 'Hasil dari 1/4 + 1/2 adalah...', '2/6', '1/6', '3/4', '2/4', 'c', 'Samakan penyebut: 1/2 = 2/4, sehingga 1/4 + 2/4 = 3/4 (lihat paragraf 3).'),
  (4, 'Bentuk paling sederhana dari 6/8 adalah...', '3/4', '2/3', '1/2', '6/4', 'a', 'FPB dari 6 dan 8 adalah 2. Bagi pembilang dan penyebut dengan 2: 6/8 = 3/4 (lihat paragraf 4).'),
  (5, 'Hasil dari 5/6 - 1/6 adalah...', '4/12', '4/6', '6/12', '1', 'b', 'Penyebut sama: 5 - 1 = 4, hasilnya 4/6 (boleh disederhanakan menjadi 2/3).')
) as v(urut, tanya, a, b, c, d, kunci, bahas);

commit;
