/* Panel pengelola (admin lembaga & guru): Monitor, Tugas, Soal, Murid, Guru, + Lembaga untuk admin platform. Import/export Excel via SheetJS */
const TABS = { monitor: ['📊', 'Monitor'], tugas: ['📅', 'Tugas'], soal: ['📝', 'Soal'], murid: ['👩‍🎓', 'Murid'], guru: ['🧑‍🏫', 'Guru'], lembaga: ['🏫', 'Lembaga'] };
// Guru hanya mengurus tugas & soal; admin lembaga juga mengelola murid & guru; admin platform juga mengelola lembaga.
const tabsFor = () => state.user.role === 'guru' ? ['monitor', 'tugas', 'soal']
  : ['monitor', 'tugas', 'soal', 'murid', 'guru', ...(state.user.platform ? ['lembaga'] : [])];
const KLS = () => state.user.istilah || 'Kelas'; // istilah kelompok diatur per lembaga: Kelas / Rombel / Halaqah ...
const $a = s => document.querySelector(s);
let CUR = 'monitor';
const fmt = d => (d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
const norm = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v]));
const chunks = (a, n) => (a.length ? [a.slice(0, n), ...chunks(a.slice(n), n)] : []);
// nilai untuk <input type=datetime-local> (waktu lokal perangkat)
const toLocal = d => { const x = new Date(d); return isNaN(x) ? '' : new Date(x - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const toIso = v => (v ? new Date(v).toISOString() : null);
const modeLabel = m => (m === 'kuis' ? '🧠 Kuis' : m === 'setor' ? '📕 Setor buku' : '💻 Online');
// data-label dipakai CSS di layar kecil: tiap baris tabel tampil sebagai kartu bertumpuk
const labelRow = (cols, r) => { let i = 0; return r.replace(/<td/g, () => `<td data-label="${cols[i++] ?? ''}"`); };
const table = (cols, rows) => `<div class="scroll"><table class="tbl"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => labelRow(cols, r)).join('') || `<tr><td colspan="${cols.length}" class="empty">Belum ada data.</td></tr>`}</tbody></table></div>`;
const meter = (a, b) => `<div class="meter"><i style="width:${b ? a / b * 100 : 0}%"></i></div>${a}/${b}`;

const xlsxOut = (rows, name) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Data'); XLSX.writeFile(wb, name + '.xlsx'); };
const pickFile = cb => {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv';
  i.onchange = guard(async () => { if (!i.files[0]) return; const wb = XLSX.read(await i.files[0].arrayBuffer()); await cb(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false })); });
  i.click();
};

// Field: k = nama, l = label, t = tipe (text | password | area | sel | multi | datetime-local ...), r = wajib, o = pilihan, h = petunjuk kecil
function openForm(title, fields, vals, onOk) {
  let d = $a('#fdlg'); if (!d) { d = document.createElement('dialog'); d.id = 'fdlg'; document.body.append(d); }
  const v = f => esc(String(vals[f.k] ?? ''));
  const sel = (f, multi) => `<select name="${f.k}" ${multi ? 'multiple' : ''}>${f.o.map(o => `<option value="${esc(String(o[0]))}" ${!multi && String(o[0]) === String(vals[f.k] ?? '') ? 'selected' : ''}>${esc(String(o[1]))}</option>`).join('')}</select>`;
  d.innerHTML = `<form method="dialog"><h3 style="font-weight:800">${title}</h3>${fields.map(f => `<label>${f.l}</label>` + (f.t === 'area'
    ? `<textarea name="${f.k}" rows="${f.rows || 5}" ${f.r ? 'required' : ''}>${v(f)}</textarea>`
    : f.t === 'sel' ? sel(f) : f.t === 'multi' ? sel(f, true)
    : `<input name="${f.k}" type="${f.t || 'text'}" value="${v(f)}" ${f.r ? 'required' : ''}>`) + (f.h ? `<small class="hint">${f.h}</small>` : '')).join('')}
    <p class="err" role="alert"></p>
    <div class="row"><button type="button" class="btn ghost" data-x>Batal</button><button class="btn">Simpan</button></div></form>`;
  const f = d.querySelector('form'), err = f.querySelector('.err');
  f.querySelector('[data-x]').onclick = () => d.close();
  // Dialog baru ditutup setelah server menerima data; kalau gagal, isian tetap ada dan pesan error tampil di dalam dialog
  f.onsubmit = async e => {
    e.preventDefault(); err.textContent = '';
    const b = e.submitter; if (b) b.disabled = true;
    try {
      const fd = new FormData(f), out = Object.fromEntries(fd);
      for (const x of fields) if (x.t === 'multi') out[x.k] = fd.getAll(x.k); // pilihan ganda: ambil semua yang dipilih
      await onOk(out); d.close();
    }
    catch (x) { err.textContent = x.message; }
    finally { if (b) b.disabled = false; }
  };
  d.showModal();
}

function adminInit() {
  let root = $a('#adminRoot');
  if (!root) { root = document.createElement('div'); root.id = 'adminRoot'; $a('#appView .wrap').append(root); }
  const ts = tabsFor();
  root.innerHTML = `<nav class="tabs" style="--n:${ts.length}">${ts.map(k => `<button class="chip" data-t="${k}"><span class="ti">${TABS[k][0]}</span><span class="tl">${TABS[k][1]}</span></button>`).join('')}</nav><div id="panel"></div>`;
  root.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) adminTab(b.dataset.t); };
  adminTab('monitor');
}
// Satu render pada satu waktu: ketukan cepat berpindah tab diantri (yang terakhir menang), sehingga hasil lambat tidak menimpa tampilan yang lebih baru.
let tabSibuk = false, tabAntri = null;
const adminTab = async t => {
  if (tabSibuk) { tabAntri = t; return; }
  tabSibuk = true;
  try {
    CUR = t;
    document.querySelectorAll('.tabs .chip').forEach(c => c.classList.toggle('on', c.dataset.t === t));
    // batas waktu agar koneksi yang macet tidak mengunci perpindahan tab selamanya
    await Promise.race([PANELS[t]($a('#panel')), new Promise((_, no) => setTimeout(() => no(new Error('Koneksi lambat. Coba lagi.')), 20000))]);
  } catch (e) { toast(e.message); }
  finally { tabSibuk = false; if (tabAntri) { const n = tabAntri; tabAntri = null; adminTab(n); } }
};

// Panel daftar generik untuk Soal, Murid & Guru (tambah, ubah, hapus, import, export, template)
async function listPanel(p, c) {
  const rows = await c.api.list(), done = () => adminTab(CUR);
  const can = r => !c.can || c.can(r); // mis. guru hanya boleh mengubah soal buatannya sendiri
  p.innerHTML = `<div class="bar"><button class="sbtn p" id="n">＋ Tambah</button><button class="sbtn" id="i">⬆ Import</button><button class="sbtn" id="e">⬇ Export</button><button class="sbtn" id="t">📄 Template</button></div>`
    + table([...c.head, ''], rows.map(r => `<tr>${c.cells(r).map(x => `<td>${esc(String(x ?? ''))}</td>`).join('')}<td style="white-space:nowrap">${can(r) ? `<button class="sbtn" data-e="${r.id}">Ubah</button> <button class="sbtn" data-d="${r.id}">Hapus</button>` : ''}</td></tr>`));
  $a('#n').onclick = () => openForm('Tambah ' + c.name, c.F, c.def || {}, async v => { await c.api.add(v); done(); });
  $a('#i').onclick = () => pickFile(async d => { let n = 0, skip = 0; for (const part of chunks(d.map(norm), c.batch || 10)) { const r = await c.api.add(part); n += r.dibuat; skip += r.dilewati; } toast(n + ' data diimpor' + (skip ? `, ${skip} dilewati (kosong / bentrok akun lain)` : '')); done(); });
  $a('#e').onclick = () => xlsxOut(rows.map(c.out), c.name);
  $a('#t').onclick = () => xlsxOut([c.sample], 'template-' + c.name);
  p.onclick = guard(async e => {
    const b = e.target.closest('[data-e],[data-d]'); if (!b) return;
    const r = rows.find(x => x.id == (b.dataset.e || b.dataset.d));
    if (b.dataset.d) { if (confirm('Hapus ' + c.name + ' ini?')) { await c.api.del(r.id); done(); } }
    else openForm('Ubah ' + c.name, c.F, r, async v => { await c.api.set(r.id, v); done(); });
  });
}

/* ---------- Tugas: daftar, buat, rekap per tugas ---------- */
async function showDetail(id) {
  CUR = 'tugas';
  const { tugas: t, murid, soal = [] } = await api.tugas.get(id);
  const aktif = murid.filter(m => m.status === 'aktif'), selesai = aktif.filter(m => m.selesai_at), belum = aktif.filter(m => !m.selesai_at);
  const setor = t.mode === 'setor', kuis = t.mode === 'kuis', ns = soal.length;
  const adaSkor = aktif.filter(m => m.skor != null), rata = adaSkor.length && ns ? Math.round(adaSkor.reduce((a, m) => a + m.skor, 0) / adaSkor.length / ns * 100) : 0;
  const st = m => m.status === 'dicabut' ? ['cab', 'Dicabut'] : m.selesai_at ? ['ok', m.ditandai_oleh === 'guru' ? '✓ Diterima guru' : '✓ Selesai (murid)'] : ['no', 'Belum'];
  const p = $a('#panel'), kembali = () => adminTab('tugas');
  p.innerHTML = `<div class="bar"><button class="sbtn p" id="bk">← Semua tugas</button><button class="sbtn" id="ed">✏️ Ubah</button><button class="sbtn" id="ex">⬇ Export</button><button class="sbtn" id="dl">🗑 Hapus</button></div>
    <div class="detail-h"><h3>${esc(t.judul)}</h3><p>${esc(t.mapel)} · ${modeLabel(t.mode)} · ${esc(t.sasaran)}</p>${kuis ? `<details><summary class="mut" style="cursor:pointer;margin-top:6px">📖 Lihat materi</summary><p class="isi">${esc(t.isi)}</p></details>` : `<p class="isi">${esc(t.isi)}</p>`}</div>
    <div class="kpi"><div><b>${selesai.length}/${aktif.length}</b>${setor ? 'Sudah setor' : 'Sudah selesai'}</div>${kuis ? `<div><b>${rata}%</b>Rata-rata skor</div>` : `<div><b>${belum.length}</b>Belum</div>`}<div><b>${fmt(t.tenggat)}</b>Tenggat</div></div>
    ${belum.length && !kuis ? `<div class="bar"><button class="sbtn p" id="all">✅ ${setor ? 'Terima' : 'Tandai'} semua yang belum (${belum.length})</button></div>` : ''}`
    + (kuis ? `<h4 style="margin:16px 0 8px">Soal yang paling banyak salah <small class="mut">(percobaan pertama)</small></h4>`
      + table(['No', 'Pertanyaan', '% salah', 'Salah / dijawab'], soal.map((s, i) => ({ ...s, no: i + 1, pct: s.dijawab ? s.salah / s.dijawab : 0 }))
        .sort((a, b) => b.pct - a.pct || b.salah - a.salah)
        .map(s => `<tr><td>${s.no}</td><td>${esc(s.tanya.length > 80 ? s.tanya.slice(0, 80) + '…' : s.tanya)}</td><td>${s.dijawab ? Math.round(s.pct * 100) + '%' : '-'}</td><td>${s.salah}/${s.dijawab}</td></tr>`))
      + `<h4 style="margin:18px 0 8px">Hasil per murid</h4>` : '')
    + table(kuis ? ['Nama', KLS(), 'Status', 'Skor', ''] : ['Nama', KLS(), 'Status', ''], murid.map(m => { const [c, l] = st(m);
      const skor = kuis ? `<td>${m.skor != null ? `${m.skor}/${ns} <small class="mut">${m.percobaan}× coba</small>` : '-'}</td>` : '';
      return `<tr><td>${esc(m.nama)}</td><td>${esc(m.kelas)}</td><td><span class="st ${c}">${l}</span></td>${skor}<td style="white-space:nowrap">${m.status === 'dicabut'
        ? `<button class="sbtn" data-s="${m.id}" data-v="aktif">Aktifkan</button>`
        : `${kuis ? '' : `<button class="sbtn ${m.selesai_at ? '' : 'p'}" data-t="${m.id}" data-v="${m.selesai_at ? 0 : 1}">${m.selesai_at ? 'Batalkan' : setor ? 'Terima' : 'Tandai'}</button> `}<button class="sbtn" data-s="${m.id}" data-v="dicabut">Cabut</button>`}</td></tr>`; }));
  // simpan posisi gulir supaya daftar tidak melompat setelah tiap ketukan
  const muat = async fn => { const y = scrollY; await fn(); await showDetail(id); scrollTo(0, y); };
  $a('#bk').onclick = kembali;
  $a('#ex').onclick = () => xlsxOut(murid.map(m => ({ Nama: m.nama, NIS: m.nis, [KLS()]: m.kelas, Status: st(m)[1], ...(kuis ? { Skor: m.skor ?? '', 'Jumlah soal': ns, Percobaan: m.skor != null ? m.percobaan : '' } : {}), Waktu: m.selesai_at ? fmt(m.selesai_at) : '' })), 'rekap-' + t.judul.slice(0, 30));
  $a('#dl').onclick = guard(async () => { if (confirm('Hapus tugas ini beserta rekap seluruh murid?')) { await api.tugas.del(id); toast('Tugas dihapus'); kembali(); } });
  $a('#ed').onclick = () => openForm('Ubah tugas', [
    { k: 'judul', l: 'Judul', r: 1 }, { k: 'mapel', l: 'Mata pelajaran', r: 1 }, { k: 'isi', l: kuis ? 'Materi' : 'Isi / instruksi', t: 'area', r: 1, rows: kuis ? 12 : 5 },
    { k: 'mode', l: 'Cara mengumpulkan', t: 'sel', o: kuis ? [['kuis', '🧠 Kuis – baca materi lalu jawab soal']] : [['online', '💻 Online – murid mencentang sendiri'], ['setor', '📕 Setor buku – guru menandai saat diterima']] },
    { k: 'mulai', l: 'Mulai tampil', t: 'datetime-local', r: 1 }, { k: 'tenggat', l: 'Tenggat', t: 'datetime-local', r: 1, h: kuis ? 'Sasaran dan soal tidak bisa diubah. Untuk soal atau sasaran lain, buat tugas baru.' : 'Sasaran tidak bisa diubah. Untuk sasaran lain, buat tugas baru.' }],
    { ...t, mulai: toLocal(t.mulai), tenggat: toLocal(t.tenggat) },
    async v => { await api.tugas.set(id, { ...v, mulai: toIso(v.mulai), tenggat: toIso(v.tenggat) }); toast('Tugas diperbarui ✓'); showDetail(id); });
  const all = $a('#all');
  if (all) all.onclick = guard(() => muat(() => api.tugas.setor(belum.map(m => m.id), true)));
  p.onclick = guard(async e => {
    const b = e.target.closest('[data-t],[data-s]'); if (!b) return;
    if (b.dataset.t) await muat(() => api.tugas.setor([+b.dataset.t], b.dataset.v === '1')); // satu ketukan per murid
    else await muat(() => api.tugas.status([+b.dataset.s], b.dataset.v));
  });
}

let SOALTAB = 'teks'; // sub-tab di dalam tab Soal
const soalTeks = p => listPanel(p, {
    name: 'soal', api: api.soal, head: ['Judul', 'Mapel', 'Isi', 'Pembuat'], cells: r => [r.judul, r.mapel, r.isi.slice(0, 60), r.pembuat],
    can: r => state.user.role === 'admin' || r.dibuat_oleh === state.user.id,
    F: [{ k: 'judul', l: 'Judul', r: 1 }, { k: 'mapel', l: 'Mata pelajaran', r: 1 }, { k: 'isi', l: 'Isi soal / instruksi', t: 'area', r: 1 }],
    out: r => ({ judul: r.judul, mapel: r.mapel, isi: r.isi }), sample: { judul: 'Latihan pecahan', mapel: 'Matematika', isi: 'Kerjakan soal no. 1-10 hal. 45' }
  });

const PANELS = {
  async monitor(p) {
    const m = await api.monitor(), T = m.murid.reduce((a, r) => (a.t += r.total, a.s += r.selesai, a.l += r.terlambat, a), { t: 0, s: 0, l: 0 });
    p.innerHTML = `<div class="kpi"><div><b>${m.murid.length}</b>Murid aktif</div><div><b>${m.soal}</b>Bank soal</div><div><b>${T.t ? Math.round(T.s / T.t * 100) : 0}%</b>Selesai</div><div><b>${T.l}</b>Terlambat</div><div><b>${m.terjadwal}</b>Terjadwal</div></div>
      <div class="bar"><button class="sbtn p" id="x">⬇ Export Excel</button></div>`
      + table(['NIS', 'Nama', KLS(), 'Progres', 'Terlambat'], m.murid.map(r => `<tr><td>${esc(r.nis)}</td><td>${esc(r.nama)}</td><td>${esc(r.kelas)}</td><td>${meter(r.selesai, r.total)}</td><td>${r.terlambat}</td></tr>`));
    $a('#x').onclick = () => xlsxOut(m.murid.map(r => ({ NIS: r.nis, Nama: r.nama, [KLS()]: r.kelas, Ditugaskan: r.total, Selesai: r.selesai, Terlambat: r.terlambat })), 'monitor-pr');
  },

  async tugas(p) {
    const [rows, soal, murid, paket] = await Promise.all([api.tugas.list(), api.soal.list(), api.murid.list(), api.paket.list()]);
    const uniq = k => [...new Set(murid.filter(m => m.aktif).map(m => m[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    p.innerHTML = `<div class="bar"><button class="sbtn p" id="n">＋ Tugas baru</button><button class="sbtn" id="e">⬇ Export rekap</button></div>`
      + table(['Tugas', 'Cara', 'Sasaran', 'Tenggat', 'Progres', ''], rows.map(r => `<tr><td><b>${esc(r.judul)}</b><small class="mut">${esc(r.mapel)}${r.pembuat ? ' · ' + esc(r.pembuat) : ''}</small></td><td>${modeLabel(r.mode)}</td><td>${esc(r.sasaran)}</td><td>${fmt(r.tenggat)}${new Date(r.mulai) > new Date() ? ' <small class="mut">(terjadwal)</small>' : ''}</td><td>${meter(r.selesai, r.total)}</td><td><button class="sbtn" data-o="${r.id}">Buka rekap</button></td></tr>`));
    if (rows.length >= 500) toast('Hanya 500 tugas terbaru yang ditampilkan.');
    p.onclick = guard(async e => { const b = e.target.closest('[data-o]'); if (b) await showDetail(+b.dataset.o); });
    $a('#e').onclick = () => xlsxOut(rows.map(r => ({ Tugas: r.judul, Mapel: r.mapel, Cara: r.mode === 'kuis' ? 'Kuis' : r.mode === 'setor' ? 'Setor buku' : 'Online', Sasaran: r.sasaran, Mulai: fmt(r.mulai), Tenggat: fmt(r.tenggat), Ditugaskan: r.total, Selesai: r.selesai, Dicabut: r.dicabut, Pembuat: r.pembuat || '' })), 'rekap-tugas');
    $a('#n').onclick = () => openForm('Tugas baru', [
      { k: 'soal_id', l: 'Ambil dari bank soal (opsional)', t: 'sel', o: [['', 'Tulis sendiri'], ...soal.map(s => [s.id, `${s.mapel} – ${s.judul}`])] },
      { k: 'judul', l: 'Judul', h: 'Boleh kosong jika memilih dari bank soal.' },
      { k: 'mapel', l: 'Mata pelajaran' },
      { k: 'isi', l: 'Isi / instruksi', t: 'area' },
      { k: 'mode', l: 'Cara mengumpulkan', t: 'sel', o: [['online', '💻 Online – murid mencentang sendiri'], ['setor', '📕 Setor buku – guru menandai saat diterima'], ['kuis', '🧠 Kuis – baca materi lalu jawab soal pilihan ganda']] },
      { k: 'paket_id', l: 'Paket kuis (hanya bila cara = Kuis)', t: 'sel', o: [['', paket.length ? '— pilih paket —' : '— belum ada paket (buat di tab Soal › Paket kuis) —'], ...paket.map(x => [x.id, `${x.mapel} – ${x.judul} (${x.jumlah} soal)`])], h: 'Judul, mapel, dan materi diambil dari paket. Soalnya disalin, jadi mengubah paket nanti tidak mengubah tugas ini.' },
      { k: 'tingkat', l: 'Sasaran: tingkat', t: 'sel', o: [['', 'Semua tingkat'], ...uniq('tingkat').map(x => [x, x])] },
      { k: 'kelas', l: 'Sasaran: ' + KLS().toLowerCase(), t: 'sel', o: [['', 'Semua ' + KLS().toLowerCase()], ...uniq('kelas').map(x => [x, x])] },
      { k: 'murid_ids', l: 'Sasaran: murid tertentu (opsional)', t: 'multi', o: murid.filter(m => m.aktif).map(m => [m.id, `${m.nama}${m.kelas ? ' (' + m.kelas + ')' : ''}`]), h: 'Tahan Ctrl / ⌘ untuk memilih banyak. Tingkat, kelas, dan murid yang dipilih digabung; jika semuanya dikosongkan, tugas untuk semua murid.' },
      { k: 'mulai', l: 'Mulai tampil (kosong = sekarang)', t: 'datetime-local' },
      { k: 'tenggat', l: 'Tenggat', t: 'datetime-local', r: 1 }], { mode: 'online' },
      async v => {
        if (v.mode === 'kuis' && !v.paket_id) throw new Error('Pilih paket kuis dulu.');
        const r = await api.tugas.add({ soal_id: v.soal_id ? +v.soal_id : null, paket_id: v.mode === 'kuis' ? +v.paket_id : null, judul: v.judul, mapel: v.mapel, isi: v.isi, mode: v.mode, tingkat: v.tingkat, kelas: v.kelas, murid_ids: v.murid_ids.map(Number), mulai: toIso(v.mulai), tenggat: toIso(v.tenggat) });
        toast(r.jumlah + ' murid ditugaskan ✓'); adminTab('tugas');
      });
  },

  async soal(p) {
    p.innerHTML = `<div class="chips" id="sw" style="margin:0 0 12px"><button class="chip ${SOALTAB === 'teks' ? 'on' : ''}" data-sw="teks">📝 Soal teks</button><button class="chip ${SOALTAB === 'paket' ? 'on' : ''}" data-sw="paket">🧠 Paket kuis</button></div><div id="sub"></div>`;
    $a('#sw').onclick = e => { const b = e.target.closest('[data-sw]'); if (b) { SOALTAB = b.dataset.sw; adminTab('soal'); } };
    return SOALTAB === 'paket' ? paketPanel($a('#sub')) : soalTeks($a('#sub'));
  },
  murid: p => listPanel(p, {
    name: 'murid', api: api.murid, head: ['NIS', 'Nama', KLS(), 'Tingkat', 'Status'], cells: r => [r.nis, r.nama, r.kelas, r.tingkat, r.aktif ? 'Aktif' : 'Nonaktif'],
    F: [{ k: 'nis', l: 'NIS (hanya saat tambah)', r: 1 }, { k: 'nama', l: 'Nama', r: 1 }, { k: 'kelas', l: KLS() + ' (nama bebas, mis. XI RPL 1)' }, { k: 'tingkat', l: 'Tingkat (opsional, mis. 7 / XI)' },
      { k: 'password', l: 'Kata sandi (kosong = NIS saat tambah / tidak diubah saat ubah). Murid wajib menggantinya saat login.', t: 'password' }, { k: 'aktif', l: 'Status', t: 'sel', o: [['true', 'Aktif'], ['false', 'Nonaktif']] }],
    batch: 5, def: { aktif: 'true' }, out: r => ({ nis: r.nis, nama: r.nama, kelas: r.kelas, tingkat: r.tingkat, aktif: r.aktif ? 'ya' : 'tidak' }), sample: { nis: '012345', nama: 'Budi Santoso', kelas: '7A', tingkat: '7', password: '' }
  }),
  guru: p => listPanel(p, {
    name: 'guru', api: api.guru, head: ['Username', 'Nama', 'Status'], cells: r => [r.nis, r.nama, r.aktif ? 'Aktif' : 'Nonaktif'],
    F: [{ k: 'nis', l: 'Username (hanya saat tambah)', r: 1 }, { k: 'nama', l: 'Nama', r: 1 },
      { k: 'password', l: 'Kata sandi (kosong = sama dengan username saat tambah / tidak diubah saat ubah). Guru wajib menggantinya saat login.', t: 'password' }, { k: 'aktif', l: 'Status', t: 'sel', o: [['true', 'Aktif'], ['false', 'Nonaktif']] }],
    batch: 5, def: { aktif: 'true' }, out: r => ({ nis: r.nis, nama: r.nama, aktif: r.aktif ? 'ya' : 'tidak' }), sample: { nis: 'siti.guru', nama: 'Siti Aminah, S.Pd', password: '' }
  }),

  // Hanya tampil untuk admin platform
  async lembaga(p) {
    const rows = await api.lembaga.list();
    p.innerHTML = `<div class="bar"><button class="sbtn p" id="n">＋ Lembaga baru</button></div>`
      + table(['Kode', 'Nama', 'Murid', 'Guru', 'Status', ''], rows.map(r => `<tr><td><b>${esc(r.kode)}</b></td><td>${esc(r.nama)}</td><td>${r.murid}</td><td>${r.guru}</td><td>${r.aktif ? 'Aktif' : 'Nonaktif'}${r.platform ? ' (platform)' : ''}</td><td><button class="sbtn" data-e="${r.id}">Ubah</button></td></tr>`))
      + `<p class="mut" style="margin-top:10px;font-size:.85rem">Kode lembaga dipakai guru &amp; murid saat login. Bagikan bersama username dan sandi awalnya.</p>`;
    const done = () => adminTab('lembaga');
    $a('#n').onclick = () => openForm('Lembaga baru', [
      { k: 'kode', l: 'Kode lembaga', r: 1, h: 'Huruf kecil, angka, atau tanda hubung (3-30 karakter). Tidak bisa diubah nanti.' },
      { k: 'nama', l: 'Nama lembaga', r: 1 },
      { k: 'istilah_kelas', l: 'Istilah untuk kelompok', h: 'Mis. Kelas, Rombel, Halaqah. Kosong = Kelas.' },
      { k: 'admin_nis', l: 'Username admin lembaga', r: 1 }, { k: 'admin_nama', l: 'Nama admin lembaga' },
      { k: 'admin_password', l: 'Kata sandi admin (min. 6 karakter)', t: 'password', r: 1 }], { istilah_kelas: 'Kelas' },
      async v => { await api.lembaga.add(v); toast('Lembaga dibuat ✓'); done(); });
    p.onclick = guard(async e => {
      const b = e.target.closest('[data-e]'); if (!b) return;
      const r = rows.find(x => x.id == b.dataset.e);
      openForm('Ubah lembaga', [{ k: 'nama', l: 'Nama lembaga', r: 1 }, { k: 'istilah_kelas', l: 'Istilah untuk kelompok' },
        ...(r.platform ? [] : [{ k: 'aktif', l: 'Status (nonaktif = semua akunnya langsung tidak bisa masuk)', t: 'sel', o: [['true', 'Aktif'], ['false', 'Nonaktif']] }])],
        { ...r, aktif: String(r.aktif) }, async v => { await api.lembaga.set(r.id, { ...v, aktif: r.platform ? true : v.aktif }); done(); });
    });
  }
};


/* ---------- Paket kuis: satu materi + soal pilihan ganda A-D. Paket milik lembaga Platform = template untuk semua lembaga ---------- */
const FORM_SOAL = [
  { k: 'tanya', l: 'Pertanyaan', t: 'area', r: 1, rows: 3 },
  { k: 'a', l: 'Pilihan A', r: 1 }, { k: 'b', l: 'Pilihan B', r: 1 }, { k: 'c', l: 'Pilihan C', r: 1 }, { k: 'd', l: 'Pilihan D', r: 1 },
  { k: 'kunci', l: 'Jawaban yang benar', t: 'sel', o: [['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D']] },
  { k: 'bahas', l: 'Pembahasan singkat (opsional)', t: 'area', rows: 3, h: 'Muncul setelah murid menjawab. Mis. "Lihat paragraf 2 materi".' }
];

async function paketPanel(p) {
  const rows = await api.paket.list(), platform = state.user.platform;
  p.innerHTML = `<div class="bar"><button class="sbtn p" id="n">＋ Paket baru</button>${platform ? '' : '<button class="sbtn" id="tp">📚 Pakai template</button>'}</div>`
    + (platform ? `<p class="mut" style="margin-bottom:10px;font-size:.88rem">Paket yang dibuat di sini menjadi <b>template</b>: semua lembaga bisa menyalinnya lalu mengubahnya sesuai kebutuhan.</p>` : '')
    + table(['Judul', 'Mapel', 'Soal', 'Pembuat', ''], rows.map(r => `<tr><td><b>${esc(r.judul)}</b></td><td>${esc(r.mapel)}</td><td>${r.jumlah}</td><td>${esc(r.pembuat || '')}</td><td><button class="sbtn" data-o="${r.id}">Buka</button></td></tr>`));
  $a('#n').onclick = () => openForm('Paket baru', [
    { k: 'judul', l: 'Judul', r: 1 }, { k: 'mapel', l: 'Mata pelajaran', r: 1 },
    { k: 'materi', l: 'Materi (dibaca murid sebelum menjawab)', t: 'area', r: 1, rows: 12, h: 'Teks biasa. Pisahkan paragraf dengan baris kosong. Soal ditambahkan setelah paket dibuat.' }], {},
    async v => { const r = await api.paket.add(v); toast('Paket dibuat ✓'); showPaket(r.id); });
  const tp = $a('#tp');
  if (tp) tp.onclick = guard(async () => {
    const tpl = await api.paket.template();
    if (!tpl.length) { toast('Belum ada template dari platform.'); return; }
    openForm('Pakai template', [{ k: 'id', l: 'Pilih template', t: 'sel', o: tpl.map(x => [x.id, `${x.mapel} – ${x.judul} (${x.jumlah} soal)`]), h: 'Template disalin menjadi paket milik lembaga Anda, lalu bebas diubah.' }], {},
      async v => { const r = await api.paket.salin(+v.id); toast('Template disalin ✓'); showPaket(r.id); });
  });
  p.onclick = guard(async e => { const b = e.target.closest('[data-o]'); if (b) await showPaket(+b.dataset.o); });
}

async function showPaket(id) {
  CUR = 'soal'; SOALTAB = 'paket';
  const { paket: k, soal } = await api.paket.get(id);
  const bisa = state.user.role === 'admin' || k.dibuat_oleh === state.user.id;
  const p = $a('#panel'), kembali = () => adminTab('soal'), segar = () => showPaket(id);
  p.innerHTML = `<div class="bar"><button class="sbtn p" id="bk">← Semua paket</button>${bisa ? `<button class="sbtn" id="ed">✏️ Ubah materi</button><button class="sbtn" id="ad">＋ Soal</button><button class="sbtn" id="im">⬆ Import soal</button><button class="sbtn" id="tx">📄 Template Excel</button><button class="sbtn" id="dl">🗑 Hapus paket</button>` : ''}</div>
    <div class="detail-h"><h3>${esc(k.judul)}</h3><p>${esc(k.mapel)} · ${soal.length} soal${k.pembuat ? ' · ' + esc(k.pembuat) : ''}</p><p class="isi">${esc(k.materi)}</p></div>`
    + table(['No', 'Pertanyaan', 'Kunci', ''], soal.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.tanya.length > 90 ? s.tanya.slice(0, 90) + '…' : s.tanya)}</td><td><b>${s.kunci.toUpperCase()}</b></td><td style="white-space:nowrap">${bisa ? `<button class="sbtn" data-e="${s.id}">Ubah</button> <button class="sbtn" data-d="${s.id}">Hapus</button>` : ''}</td></tr>`));
  $a('#bk').onclick = kembali;
  if (!bisa) return;
  $a('#ed').onclick = () => openForm('Ubah paket', [
    { k: 'judul', l: 'Judul', r: 1 }, { k: 'mapel', l: 'Mata pelajaran', r: 1 },
    { k: 'materi', l: 'Materi', t: 'area', r: 1, rows: 12, h: 'Tugas yang sudah dibuat dari paket ini tidak berubah; perubahan berlaku untuk tugas berikutnya.' }], k,
    async v => { await api.paket.set(id, v); toast('Paket diperbarui ✓'); segar(); });
  $a('#ad').onclick = () => openForm('Tambah soal', FORM_SOAL, { kunci: 'a' }, async v => { await api.paketSoal.add(id, [v]); segar(); });
  $a('#im').onclick = () => pickFile(async d => {
    const list = d.map(norm).map(r => ({ tanya: r.soal ?? r.tanya ?? r.pertanyaan ?? '', a: r.a ?? '', b: r.b ?? '', c: r.c ?? '', d: r.d ?? '', kunci: r.kunci ?? '', bahas: r.pembahasan ?? r.bahas ?? '' }));
    let n = 0, skip = 0;
    for (const part of chunks(list, 50)) { const r = await api.paketSoal.add(id, part); n += r.dibuat; skip += r.dilewati; }
    toast(n ? `${n} soal diimpor${skip ? `, ${skip} dilewati (kolom kosong / kunci bukan A-D)` : ''}` : 'Tidak ada soal yang valid. Kolom yang dibutuhkan: soal, a, b, c, d, kunci, pembahasan.');
    segar();
  });
  $a('#tx').onclick = () => xlsxOut([{ soal: 'Organ yang menyerap sari makanan adalah...', a: 'Lambung', b: 'Usus halus', c: 'Usus besar', d: 'Hati', kunci: 'B', pembahasan: 'Lihat paragraf 2 materi.' }], 'template-soal-kuis');
  $a('#dl').onclick = guard(async () => { if (confirm('Hapus paket ini beserta semua soalnya? Tugas yang sudah dibuat dari paket ini tidak terpengaruh.')) { await api.paket.del(id); toast('Paket dihapus'); kembali(); } });
  p.onclick = guard(async e => {
    const b = e.target.closest('[data-e],[data-d]'); if (!b) return;
    const s = soal.find(x => x.id == (b.dataset.e || b.dataset.d));
    if (b.dataset.d) { if (confirm('Hapus soal ini?')) { await api.paketSoal.del(s.id); segar(); } }
    else openForm('Ubah soal', FORM_SOAL, s, async v => { await api.paketSoal.set(s.id, v); segar(); });
  });
}
