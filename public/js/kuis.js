/* Kuis (sisi murid): baca materi -> jawab soal satu per satu dengan umpan balik langsung -> hasil.
   Kunci & pembahasan baru dikirim server setelah soal dijawab. Tugas selesai saat semua soal dijawab; skor tidak menentukan status. */
const K = { id: null, kuis: null, soal: [], jawab: new Map(), i: 0 };
const HURUF = ['a', 'b', 'c', 'd'];
const kroot = () => $('#kuisRoot');
const pendek = (t, n = 90) => (t.length > n ? t.slice(0, n) + '…' : t);
const pertamaBelum = () => Math.max(0, K.soal.findIndex(s => !K.jawab.has(s.id)));

async function bukaKuis(id) {
  let d;
  try { d = await api.kuis.get(id); } catch (e) { toast(e.message); return; }
  K.id = id; K.kuis = d.kuis; K.soal = d.soal; K.jawab = new Map(d.jawaban.map(j => [j.soal_id, j]));
  $('#appView').classList.add('kuis'); kroot().classList.remove('hidden');
  if (K.jawab.size >= K.soal.length) tampilHasil();
  else if (K.jawab.size) tampilSoal(pertamaBelum());
  else tampilMateri(false);
}
function tutupKuis() {
  kroot().classList.add('hidden'); kroot().innerHTML = '';
  $('#appView').classList.remove('kuis'); render();
}
const layar = html => { kroot().innerHTML = html; scrollTo(0, 0); };

function tampilMateri(dariHasil) {
  const k = K.kuis;
  layar(`<div class="khead"><button class="sbtn" id="kBack">← Kembali</button><span class="mut">${esc(k.mapel)} · ${K.soal.length} soal</span></div>
    <article class="kcard"><h3>${esc(k.judul)}</h3>
      <p class="mut" style="font-size:.9rem">Baca materi di bawah ini dengan teliti, lalu jawab soalnya. Kamu masih bisa membuka materi lagi saat menjawab.</p>
      <div class="materi">${esc(k.materi)}</div>
      <button class="btn" id="kGo">${dariHasil ? '← Kembali ke hasil' : (K.jawab.size ? 'Lanjutkan soal →' : 'Sudah baca, mulai soal →')}</button></article>`);
  $('#kBack').onclick = dariHasil ? tampilHasil : tutupKuis;
  $('#kGo').onclick = () => (dariHasil ? tampilHasil() : tampilSoal(pertamaBelum()));
}

function tampilSoal(i) {
  K.i = i; const s = K.soal[i], j = K.jawab.get(s.id), total = K.soal.length;
  layar(`<div class="khead"><button class="sbtn" id="kBack">← Keluar</button><span class="mut">Soal ${i + 1} dari ${total}</span><button class="sbtn" id="kMat">📖 Materi</button></div>
    <div class="kbar"><i style="width:${K.jawab.size / total * 100}%"></i></div>
    <div class="materi hidden" id="kMatBox">${esc(K.kuis.materi)}</div>
    <article class="kcard"><div class="ktanya">${esc(s.tanya)}</div>
      <div class="kopsi">${HURUF.map(h => `<button class="opt" data-p="${h}"><b>${h.toUpperCase()}</b><span>${esc(s[h])}</span></button>`).join('')}</div>
      <div id="kFb"></div><div id="kNav"></div></article>`);
  $('#kBack').onclick = tutupKuis;
  $('#kMat').onclick = () => $('#kMatBox').classList.toggle('hidden');
  document.querySelector('.kopsi').onclick = async e => {
    const b = e.target.closest('.opt'); if (!b || b.disabled) return;
    document.querySelectorAll('.opt').forEach(x => x.disabled = true); // cegah ketukan ganda
    try {
      const r = await api.kuis.jawab(K.id, s.id, b.dataset.p);
      K.jawab.set(s.id, { soal_id: s.id, pilih: r.pilih, benar: r.benar, kunci: r.kunci, bahas: r.bahas });
      tandai(K.jawab.get(s.id));
    } catch (err) { toast(err.message); document.querySelectorAll('.opt').forEach(x => x.disabled = false); }
  };
  if (j) tandai(j);
}
// Tampilkan umpan balik setelah soal dijawab: pilihan benar hijau, pilihan salah merah, pembahasan, lalu tombol lanjut
function tandai(j) {
  document.querySelectorAll('.opt').forEach(b => {
    b.disabled = true;
    if (b.dataset.p === j.kunci) b.classList.add('benar'); else if (b.dataset.p === j.pilih) b.classList.add('salah');
  });
  $('#kFb').innerHTML = `<div class="kfb ${j.benar ? 'ok' : 'no'}"><b>${j.benar ? 'Benar! 🎉' : 'Belum tepat'}</b>`
    + (j.benar ? '' : `<p>Jawaban yang benar: <b>${j.kunci.toUpperCase()}</b></p>`)
    + (j.bahas ? `<p class="isi">${esc(j.bahas)}</p>` : '') + '</div>';
  const habis = K.jawab.size >= K.soal.length;
  $('#kNav').innerHTML = `<button class="btn" id="kNext">${habis ? 'Lihat hasil' : 'Lanjut'} →</button>`;
  $('#kNext').onclick = () => {
    if (habis) return tampilHasil();
    const sb = K.soal[K.i + 1];
    tampilSoal(sb && !K.jawab.has(sb.id) ? K.i + 1 : pertamaBelum());
  };
  $('#kNext').focus();
}

function tampilHasil() {
  const total = K.soal.length, benar = [...K.jawab.values()].filter(j => j.benar).length;
  const terbaik = Math.max(K.kuis.skor_terbaik ?? 0, benar), pct = total ? benar / total : 0;
  const pesan = pct >= .8 ? 'Hebat! Kamu menguasai materinya 🎉' : pct >= .6 ? 'Bagus! Sedikit lagi sempurna 💪' : 'Tidak apa-apa. Baca materinya sekali lagi, lalu coba lagi ya 📖';
  layar(`<div class="khead"><button class="sbtn" id="kBack">← Kembali ke daftar PR</button></div>
    <article class="kcard"><div class="kskor"><div class="angka">${benar}/${total}</div><p>${pesan}</p><p class="mut" style="font-size:.9rem">Skor terbaikmu: ${terbaik}/${total}</p></div>
      <div class="kreview">${K.soal.map((s, i) => { const j = K.jawab.get(s.id);
        return `<div>${j?.benar ? '✅' : '❌'} <b>${i + 1}.</b> ${esc(pendek(s.tanya))}${j && !j.benar ? `<small>Yang benar: ${j.kunci.toUpperCase()}. ${esc(s[j.kunci])}</small>` : ''}${j?.bahas ? `<small>${esc(j.bahas)}</small>` : ''}</div>`; }).join('')}</div>
      <div class="stack"><button class="btn ghost" id="kMat">📖 Baca materi lagi</button><button class="btn" id="kUlang">🔁 Ulangi kuis</button></div></article>`);
  $('#kBack').onclick = tutupKuis;
  $('#kMat').onclick = () => tampilMateri(true);
  $('#kUlang').onclick = async () => {
    try {
      await api.kuis.ulang(K.id);
      const d = await api.kuis.get(K.id); K.kuis = d.kuis; K.soal = d.soal; K.jawab = new Map(d.jawaban.map(j => [j.soal_id, j]));
      tampilSoal(0);
    } catch (e) { toast(e.message); }
  };
}
