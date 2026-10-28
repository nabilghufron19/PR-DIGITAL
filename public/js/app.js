
const SUBJECTS = {
  'Matematika':['🧮','#FFEAA7'], 'Bahasa Indonesia':['📖','#FAB1A0'],
  'IPA':['🔬','#81ECEC'], 'IPS':['🌏','#A29BFE'], 'Bahasa Inggris':['🔤','#FD79A8'],
  'PJOK':['⚽','#55EFC4'], 'Seni Budaya':['🎨','#FDCB6E']
};
const state = { user:null, filter:'all', items:[] };

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- tema ---------- */
const SUN=`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const MOON=`<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
function setTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  $('#themeBtn').innerHTML = t === 'dark' ? SUN : MOON;
  try{ localStorage.setItem('theme', t) }catch(e){}
}
(function(){
  let t = null; try{ t = localStorage.getItem('theme') }catch(e){}
  setTheme(t || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
})();
$('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

/* ---------- login ---------- */
$('#togglePw').onclick = () => {
  const p = $('#password'); const show = p.type === 'password';
  p.type = show ? 'text' : 'password';
  $('#togglePw').textContent = show ? '🙈' : '👁️';
};
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const k = $('#kode').value, u = $('#username').value, p = $('#password').value, err = $('#loginErr'), btn = $('#loginBtn');
  if (!k.trim() || !u.trim() || !p){ err.textContent = 'Isi kode lembaga, username, dan kata sandi dulu ya.'; return; }
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Memeriksa…';
  const res = await api.login(k, u, p);
  btn.disabled = false; btn.textContent = 'Masuk';
  if (!res.ok){ err.textContent = res.message; return; }
  try{ localStorage.setItem('kode', k.trim().toLowerCase()) }catch(e){}
  state.user = res.user;
  showApp();
});
// ingat kode lembaga terakhir di perangkat ini
try{ $('#kode').value = localStorage.getItem('kode') || '' }catch(e){}
// Kembali ke halaman login dan bersihkan sisa tampilan akun sebelumnya (panel admin, filter, daftar PR)
function toLogin(){
  state.user = null; state.filter = 'all';
  $('#adminRoot')?.remove();
  $('#list').innerHTML = '';
  document.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x.dataset.f === 'all'));
  $('#appView').classList.add('hidden'); $('#appView').classList.remove('admin');
  $('#loginView').classList.remove('hidden'); $('#password').value='';
  if ($('#kode').value) $('#username').focus();
  document.getElementById('fdlg')?.close();
}
$('#logoutBtn').onclick = async () => { await api.logout(); toLogin(); };
let sesiHabisBusy = false;
window.addEventListener('sesi-habis', () => {
  if (!state.user || sesiHabisBusy) return;
  sesiHabisBusy = true; toLogin(); toast('Sesi berakhir, silakan masuk lagi.');
  setTimeout(() => sesiHabisBusy = false, 500);
});

/* ---------- ganti kata sandi ---------- */
function pwDialog(wajib){
  openForm(wajib ? 'Buat kata sandi baru dulu ya 🔑' : 'Ganti kata sandi', [
    { k:'lama', l:'Kata sandi saat ini', t:'password', r:1 },
    { k:'baru', l:'Kata sandi baru (min. 6 karakter)', t:'password', r:1 },
    { k:'ulang', l:'Ulangi kata sandi baru', t:'password', r:1 }], {},
    async v => {
      if (v.baru !== v.ulang) throw new Error('Ulangan kata sandi tidak sama.');
      await api.sandi(v.lama, v.baru);
      state.user.wajib = false; toast('Kata sandi berhasil diganti ✓');
    });
}
$('#pwBtn').onclick = () => pwDialog(false);

/* ---------- aplikasi ---------- */
async function showApp(){
  $('#adminRoot')?.remove();
  $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  $('#who').textContent = state.user.name;
  const staf = state.user.role !== 'murid'; // admin & guru memakai panel pengelola
  $('#appView').classList.toggle('admin', staf);
  $('#today').textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'}) + (state.user.lembaga ? ' · ' + state.user.lembaga : '');
  staf ? adminInit() : render();
  if (state.user.wajib) pwDialog(true);
}
// it.diff dihitung server (zona Asia/Jakarta), sama dengan hitungan "terlambat" di panel admin
function dueInfo(it){
  const diff = it.diff;
  if (it.done) return ['ok', it.mode==='setor' ? 'Sudah diterima guru' : 'Sudah dikumpulkan'];
  if (diff < 0) return ['late','Terlambat '+(-diff)+' hari'];
  if (diff === 0) return ['soon','Hari ini!'];
  if (diff === 1) return ['soon','Besok'];
  return ['ok', diff+' hari lagi'];
}
async function render(){
  let all;
  try { all = await api.listPR(); } catch (e) { if (state.user) toast(e.message); return; }
  const done = all.filter(x => x.done).length, total = all.length;
  const pct = total ? Math.round(done/total*100) : 0;
  $('#sTotal').textContent = total; $('#sDone').textContent = done; $('#sTodo').textContent = total-done;
  $('#ring').style.setProperty('--p', pct); $('#pct').textContent = pct+'%';
  $('#heroTitle').textContent = pct === 100 && total ? 'Hebat, semua beres! 🎉' : 'Semangat belajar!';
  $('#heroText').textContent = total-done ? (total-done)+' PR menunggu kamu.' : 'Tidak ada PR tertunda.';
  const f = state.filter;
  const rows = all.filter(x => f==='all' || (f==='done') === x.done);
  $('#list').innerHTML = rows.length ? rows.map(it => {
    const [ico,bg] = SUBJECTS[it.subject] || ['📝','#DFE6E9']; const [cls,txt] = dueInfo(it);
    return `<article class="card ${it.done?'done':''}">
      <div class="badge" style="background:${bg}">${ico}</div>
      <div class="info"><h4>${esc(it.title)}</h4><p>${esc(it.subject)}</p><p class="isi">${esc(it.isi||'')}</p><span class="due ${cls}">${it.mode==='setor'&&!it.done?'Setor buku · '+txt:txt}</span></div>
      ${it.mode==='setor'
        ? `<span class="check setor" title="Setor langsung ke guru" aria-label="${it.done?'Sudah diterima guru':'Setor langsung ke guru'}">${it.done?'✓':'📕'}</span>`
        : `<button class="check" data-id="${it.id}" aria-label="Tandai selesai">${it.done?'✓':''}</button>`}
    </article>`;}).join('')
    : '<div class="empty"><div>🎈</div><p>Belum ada PR di sini.</p></div>';
}
$('#list').addEventListener('click', async e => {
  const b = e.target.closest('.check'); if (!b) return;
  try { await api.togglePR(+b.dataset.id); } catch (err) { toast(err.message); return; }
  render();
});
$('#chips').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  document.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
  state.filter = c.dataset.f; render();
});

/* ---------- notifikasi ---------- */
function toast(t){ const n=document.createElement('div'); n.className='toast'; n.textContent=t; n.setAttribute('role','status'); (document.querySelector('dialog[open]')||document.body).append(n); setTimeout(()=>n.remove(),2600); }

/* ---------- pulihkan sesi (cookie, berlaku 7 hari) ---------- */
api.me().then(u => { if (u){ state.user = u; showApp(); } });
