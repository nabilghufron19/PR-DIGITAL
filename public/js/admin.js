/* Panel admin: Monitor, Soal, Murid, Penugasan + import/export Excel (SheetJS) */
const TABS = { monitor: '📊 Monitor', soal: '📝 Soal', murid: '👩‍🎓 Murid', tugas: '📅 Penugasan' };
const $a = s => document.querySelector(s);
let CUR = 'monitor';
const fmt = d => (d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
const norm = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v]));
const chunks = (a, n) => (a.length ? [a.slice(0, n), ...chunks(a.slice(n), n)] : []);
const table = (cols, rows) => `<div class="scroll"><table class="tbl"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${cols.length}" class="empty">Belum ada data.</td></tr>`}</tbody></table></div>`;

const xlsxOut = (rows, name) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Data'); XLSX.writeFile(wb, name + '.xlsx'); };
const pickFile = cb => {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv';
  i.onchange = guard(async () => { if (!i.files[0]) return; const wb = XLSX.read(await i.files[0].arrayBuffer()); await cb(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false })); });
  i.click();
};

function openForm(title, fields, vals, onOk) {
  let d = $a('#fdlg'); if (!d) { d = document.createElement('dialog'); d.id = 'fdlg'; document.body.append(d); }
  const v = f => esc(String(vals[f.k] ?? ''));
  d.innerHTML = `<form method="dialog"><h3 style="font-weight:800">${title}</h3>${fields.map(f => `<label>${f.l}</label>` + (f.t === 'area'
    ? `<textarea name="${f.k}" rows="5" ${f.r ? 'required' : ''}>${v(f)}</textarea>`
    : f.t === 'sel' ? `<select name="${f.k}">${f.o.map(o => `<option value="${esc(String(o[0]))}" ${String(o[0]) === String(vals[f.k] ?? '') ? 'selected' : ''}>${esc(String(o[1]))}</option>`).join('')}</select>`
    : `<input name="${f.k}" type="${f.t || 'text'}" value="${v(f)}" ${f.r ? 'required' : ''}>`)).join('')}
    <p class="err" role="alert"></p>
    <div class="row"><button type="button" class="btn ghost" data-x>Batal</button><button class="btn">Simpan</button></div></form>`;
  const f = d.querySelector('form'), err = f.querySelector('.err');
  f.querySelector('[data-x]').onclick = () => d.close();
  // Dialog baru ditutup setelah server menerima data; kalau gagal, isian tetap ada dan pesan error tampil di dalam dialog
  f.onsubmit = async e => {
    e.preventDefault(); err.textContent = '';
    const b = e.submitter; if (b) b.disabled = true;
    try { await onOk(Object.fromEntries(new FormData(f))); d.close(); }
    catch (x) { err.textContent = x.message; }
    finally { if (b) b.disabled = false; }
  };
  d.showModal();
}

function adminInit() {
  let root = $a('#adminRoot');
  if (!root) { root = document.createElement('div'); root.id = 'adminRoot'; $a('#appView .wrap').append(root); }
  root.innerHTML = `<nav class="tabs">${Object.entries(TABS).map(([k, v]) => `<button class="chip" data-t="${k}">${v}</button>`).join('')}</nav><div id="panel"></div>`;
  root.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) adminTab(b.dataset.t); };
  adminTab('monitor');
}
const adminTab = guard(async t => {
  CUR = t;
  document.querySelectorAll('.tabs .chip').forEach(c => c.classList.toggle('on', c.dataset.t === t));
  await PANELS[t]($a('#panel'));
});

// Panel daftar generik untuk Soal & Murid (tambah, ubah, hapus, import, export, template)
async function listPanel(p, c) {
  const rows = await c.api.list(), done = () => adminTab(CUR);
  p.innerHTML = `<div class="bar"><button class="sbtn p" id="n">＋ Tambah</button><button class="sbtn" id="i">⬆ Import Excel</button><button class="sbtn" id="e">⬇ Export Excel</button><button class="sbtn" id="t">📄 Template</button></div>`
    + table([...c.head, ''], rows.map(r => `<tr>${c.cells(r).map(x => `<td>${esc(String(x ?? ''))}</td>`).join('')}<td style="white-space:nowrap"><button class="sbtn" data-e="${r.id}">Ubah</button> <button class="sbtn" data-d="${r.id}">Hapus</button></td></tr>`));
  $a('#n').onclick = () => openForm('Tambah ' + c.name, c.F, c.def || {}, async v => { await c.api.add(v); done(); });
  $a('#i').onclick = () => pickFile(async d => { let n = 0, skip = 0; for (const part of chunks(d.map(norm), c.batch || 10)) { const r = await c.api.add(part); n += r.dibuat; skip += r.dilewati; } toast(n + ' data diimpor' + (skip ? `, ${skip} dilewati (kosong / duplikat akun admin)` : '')); done(); });
  $a('#e').onclick = () => xlsxOut(rows.map(c.out), c.name);
  $a('#t').onclick = () => xlsxOut([c.sample], 'template-' + c.name);
  p.onclick = guard(async e => {
    const b = e.target.closest('[data-e],[data-d]'); if (!b) return;
    const r = rows.find(x => x.id == (b.dataset.e || b.dataset.d));
    if (b.dataset.d) { if (confirm('Hapus ' + c.name + ' ini?')) { await c.api.del(r.id); done(); } }
    else openForm('Ubah ' + c.name, c.F, r, async v => { await c.api.set(r.id, v); done(); });
  });
}

const PANELS = {
  async monitor(p) {
    const m = await api.monitor(), T = m.murid.reduce((a, r) => (a.t += r.total, a.s += r.selesai, a.l += r.terlambat, a), { t: 0, s: 0, l: 0 });
    p.innerHTML = `<div class="kpi"><div><b>${m.murid.length}</b>Murid aktif</div><div><b>${m.soal}</b>Bank soal</div><div><b>${T.t ? Math.round(T.s / T.t * 100) : 0}%</b>Selesai</div><div><b>${T.l}</b>Terlambat</div><div><b>${m.terjadwal}</b>Terjadwal</div></div>
      <div class="bar"><button class="sbtn p" id="x">⬇ Export Excel</button></div>`
      + table(['NIS', 'Nama', 'Kelas', 'Progres', 'Terlambat'], m.murid.map(r => `<tr><td>${esc(r.nis)}</td><td>${esc(r.nama)}</td><td>${esc(r.kelas)}</td><td><div class="meter"><i style="width:${r.total ? r.selesai / r.total * 100 : 0}%"></i></div>${r.selesai}/${r.total}</td><td>${r.terlambat}</td></tr>`));
    $a('#x').onclick = () => xlsxOut(m.murid.map(r => ({ NIS: r.nis, Nama: r.nama, Kelas: r.kelas, Ditugaskan: r.total, Selesai: r.selesai, Terlambat: r.terlambat })), 'monitor-pr');
  },
  soal: p => listPanel(p, {
    name: 'soal', api: api.soal, head: ['Judul', 'Mapel', 'Isi'], cells: r => [r.judul, r.mapel, r.isi.slice(0, 60)],
    F: [{ k: 'judul', l: 'Judul', r: 1 }, { k: 'mapel', l: 'Mata pelajaran', r: 1 }, { k: 'isi', l: 'Isi soal / instruksi', t: 'area', r: 1 }],
    out: r => ({ judul: r.judul, mapel: r.mapel, isi: r.isi }), sample: { judul: 'Latihan pecahan', mapel: 'Matematika', isi: 'Kerjakan soal no. 1-10 hal. 45' }
  }),
  murid: p => listPanel(p, {
    name: 'murid', api: api.murid, head: ['NIS', 'Nama', 'Kelas', 'Status'], cells: r => [r.nis, r.nama, r.kelas, r.aktif ? 'Aktif' : 'Nonaktif'],
    F: [{ k: 'nis', l: 'NIS (hanya saat tambah)', r: 1 }, { k: 'nama', l: 'Nama', r: 1 }, { k: 'kelas', l: 'Kelas' }, { k: 'password', l: 'Kata sandi (kosong = NIS saat tambah / tidak diubah saat ubah). Murid wajib menggantinya saat login.', t: 'password' }, { k: 'aktif', l: 'Status', t: 'sel', o: [['true', 'Aktif'], ['false', 'Nonaktif']] }],
    batch: 5, def: { aktif: 'true' }, out: r => ({ nis: r.nis, nama: r.nama, kelas: r.kelas, aktif: r.aktif ? 'ya' : 'tidak' }), sample: { nis: '012345', nama: 'Budi Santoso', kelas: '5A', password: '' }
  }),
  async tugas(p) {
    const [rows, soal, murid] = await Promise.all([api.tugas.list(), api.soal.list(), api.murid.list()]);
    const kelas = [...new Set(murid.map(m => m.kelas).filter(Boolean))].sort();
    const st = r => r.status === 'dicabut' ? 'Dicabut' : new Date(r.mulai) > new Date() ? 'Terjadwal' : r.selesai_at ? 'Selesai' : 'Aktif';
    p.innerHTML = `<div class="bar"><button class="sbtn p" id="n">📅 Tugaskan soal</button><button class="sbtn" id="c">⛔ Cabut terpilih</button><button class="sbtn" id="a">✅ Aktifkan terpilih</button><button class="sbtn" id="e">⬇ Export Excel</button></div>`
      + table(['', 'Soal', 'Murid', 'Kelas', 'Mulai', 'Tenggat', 'Status'], rows.map(r => `<tr><td><input type="checkbox" value="${r.id}"></td><td>${esc(r.judul)}</td><td>${esc(r.nama)}</td><td>${esc(r.kelas)}</td><td>${fmt(r.mulai)}</td><td>${fmt(r.tenggat)}</td><td>${st(r)}</td></tr>`));
    const ids = () => [...p.querySelectorAll('tbody input:checked')].map(i => +i.value);
    if (rows.length >= 5000) toast('Hanya 5.000 penugasan terbaru yang ditampilkan & diekspor.');
    const set = s => guard(async () => { if (!ids().length) return toast('Pilih penugasan dulu'); await api.tugas.status(ids(), s); adminTab('tugas'); });
    $a('#c').onclick = set('dicabut'); $a('#a').onclick = set('aktif');
    $a('#n').onclick = () => openForm('Tugaskan soal', [
      { k: 'soal_id', l: 'Soal', t: 'sel', o: soal.map(s => [s.id, `${s.mapel} – ${s.judul}`]) },
      { k: 'kelas', l: 'Kelas', t: 'sel', o: [['', 'Semua kelas'], ...kelas.map(k => [k, k])] },
      { k: 'mulai', l: 'Mulai tampil (kosong = sekarang)', t: 'datetime-local' },
      { k: 'tenggat', l: 'Tenggat', t: 'datetime-local', r: 1 }], {},
      async v => { const r = await api.tugas.assign({ soal_id: +v.soal_id, kelas: v.kelas, mulai: v.mulai ? new Date(v.mulai).toISOString() : null, tenggat: new Date(v.tenggat).toISOString() }); toast(r.jumlah + ' murid ditugaskan'); adminTab('tugas'); });
    $a('#e').onclick = () => xlsxOut(rows.map(r => ({ Soal: r.judul, NIS: r.nis, Nama: r.nama, Kelas: r.kelas, Mulai: fmt(r.mulai), Tenggat: fmt(r.tenggat), Status: st(r) })), 'penugasan');
  }
};
