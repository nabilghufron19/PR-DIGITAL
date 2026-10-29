// Sisi murid untuk tugas mode "kuis": baca materi, jawab soal satu per satu, lihat hasil, ulangi.
// Kunci jawaban & pembahasan TIDAK dikirim sebelum soal dijawab; penilaian dilakukan di server.
// Satu soal hanya bisa dijawab sekali per percobaan (jawaban pertama yang berlaku). Tugas dianggap selesai
// saat semua soal pada satu percobaan sudah dijawab, berapa pun skornya; skor terbaik dari semua percobaan dicatat.
import { route, json, bad, body, qid } from '../_lib/core.js';

async function muat(sql, u, id) {
  const [p] = await sql`select p.id,p.percobaan,p.skor_terbaik,(p.selesai_at is not null) done,
      t.id tugas_id,t.judul,t.mapel,t.isi materi
    from penugasan p join tugas t on t.id=p.tugas_id
    where p.id=${id} and p.user_id=${u.id} and p.lembaga_id=${u.lembaga_id}
      and p.status='aktif' and t.mode='kuis' and t.mulai<=now()`;
  if (!p) throw bad('Kuis tidak ditemukan');
  return p;
}

export const onRequestGet = route(['murid'], async ({ request }, u, sql) => {
  const p = await muat(sql, u, qid(request));
  const soal = await sql`select id,urut,tanya,a,b,c,d from tugas_soal where tugas_id=${p.tugas_id} order by urut,id`;
  // Hanya soal yang sudah dijawab pada percobaan ini yang ikut membawa kunci & pembahasan
  const jawaban = await sql`select j.soal_id,j.pilih,j.benar,s.kunci,s.bahas
    from jawaban j join tugas_soal s on s.id=j.soal_id
    where j.penugasan_id=${p.id} and j.percobaan=${p.percobaan}`;
  return json({ kuis: p, soal, jawaban });
});

export const onRequestPost = route(['murid'], async ({ request }, u, sql) => {
  const b = await body(request), id = +b.id, sid = +b.soal_id, pilih = String(b.pilih ?? '').toLowerCase();
  if (!Number.isInteger(id) || !Number.isInteger(sid) || !['a', 'b', 'c', 'd'].includes(pilih)) throw bad('Jawaban tidak valid');
  const p = await muat(sql, u, id);
  const [s] = await sql`select kunci,bahas from tugas_soal where id=${sid} and tugas_id=${p.tugas_id}`;
  if (!s) throw bad('Soal tidak ditemukan');
  await sql`insert into jawaban(penugasan_id,soal_id,percobaan,pilih,benar)
    values(${p.id},${sid},${p.percobaan},${pilih},${pilih === s.kunci}) on conflict do nothing`;
  const [j] = await sql`select pilih,benar from jawaban where penugasan_id=${p.id} and soal_id=${sid} and percobaan=${p.percobaan}`;
  const [r] = await sql`select count(*)::int jml, (count(*) filter (where benar))::int benar_n,
      (select count(*) from tugas_soal where tugas_id=${p.tugas_id})::int total
    from jawaban where penugasan_id=${p.id} and percobaan=${p.percobaan}`;
  const selesai = r.jml >= r.total;
  if (selesai) await sql`update penugasan set
      skor_terbaik = greatest(coalesce(skor_terbaik,0), ${r.benar_n}::int),
      selesai_at = coalesce(selesai_at, now()), ditandai_oleh = coalesce(ditandai_oleh,'murid')
    where id=${p.id}`;
  return json({ ok: true, pilih: j.pilih, benar: j.benar, kunci: s.kunci, bahas: s.bahas, jumlah: r.jml, total: r.total, selesai, skor: selesai ? r.benar_n : null });
});

// Mulai percobaan baru (hanya setelah percobaan berjalan selesai)
export const onRequestPut = route(['murid'], async ({ request }, u, sql) => {
  const id = +(await body(request)).id;
  if (!Number.isInteger(id)) throw bad('ID tidak valid');
  const p = await muat(sql, u, id);
  const r = await sql`update penugasan p set percobaan = p.percobaan + 1
    where p.id=${p.id}
      and (select count(*) from jawaban j where j.penugasan_id=p.id and j.percobaan=p.percobaan)
        >= (select count(*) from tugas_soal s where s.tugas_id=p.tugas_id)
    returning p.percobaan`;
  if (!r.length) throw bad('Selesaikan kuis ini dulu sebelum mengulang');
  return json({ ok: true, percobaan: r[0].percobaan });
});
