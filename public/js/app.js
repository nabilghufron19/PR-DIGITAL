
const SUBJECTS = {
  'Matematika':['🧮','#FFEAA7'], 'Bahasa Indonesia':['📖','#FAB1A0'],
  'IPA':['🔬','#81ECEC'], 'IPS':['🌏','#A29BFE'], 'Bahasa Inggris':['🔤','#FD79A8'],
  'PJOK':['⚽','#55EFC4'], 'Seni Budaya':['🎨','#FDCB6E']
};
const day = n => { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
const state = { user:null, filter:'all', items:[] };

const $ = s => document.querySelector(s);
const store = { get:k=>{try{return sessionStorage.getItem(k)}catch(e){return null}},
                set:(k,v)=>{try{sessionStorage.setItem(k,v)}catch(e){}},
                del:k=>{try{sessionStorage.removeItem(k)}catch(e){}} };
const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
  const u = $('#username').value, p = $('#password').value, err = $('#loginErr'), btn = $('#loginBtn');
  if (!u.trim() || !p){ err.textContent = 'Isi username dan kata sandi dulu ya.'; return; }
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Memeriksa…';
  const res = await api.login(u, p);
  btn.disabled = false; btn.textContent = 'Masuk';
  if (!res.ok){ err.textContent = res.message; return; }
  state.user = res.user;
  showApp();
});
$('#logoutBtn').onclick = () => { api.logout(); document.getElementById('adminRoot')?.remove(); $('#appView').classList.remove('admin'); state.user = null; $('#appView').classList.add('hidden'); $('#loginView').classList.remove('hidden'); $('#password').value=''; };

/* ---------- aplikasi ---------- */
async function showApp(){
  $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  $('#who').textContent = state.user.name;
  $('#appView').classList.toggle('admin', state.user.role === 'admin');
    $('#today').textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
  state.user.role === 'admin' ? adminInit() : render();
}
function dueInfo(it){
  const diff = Math.round((new Date(it.due+'T00:00:00') - new Date(new Date().toDateString())) / 864e5);
  if (it.done) return ['ok','Sudah dikumpulkan'];
  if (diff < 0) return ['late','Terlambat '+(-diff)+' hari'];
  if (diff === 0) return ['soon','Hari ini!'];
  if (diff === 1) return ['soon','Besok'];
  return ['ok', diff+' hari lagi'];
}
async function render(){
  const all = await api.listPR();
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
      <div class="info"><h4>${esc(it.title)}</h4><p>${esc(it.subject)}</p><p class="isi">${esc(it.isi||'')}</p><span class="due ${cls}">${txt}</span></div>
      <button class="check" data-id="${it.id}" aria-label="Tandai selesai">${it.done?'✓':''}</button>
    </article>`;}).join('')
    : '<div class="empty"><div>🎈</div><p>Belum ada PR di sini.</p></div>';
}
$('#list').addEventListener('click', async e => {
  const b = e.target.closest('.check'); if (!b) return;
  await api.togglePR(+b.dataset.id); render();
});
$('#chips').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  document.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
  state.filter = c.dataset.f; render();
});

/* ---------- tambah PR ---------- */
function toast(t){ const n=document.createElement('div'); n.className='toast'; n.textContent=t; document.body.append(n); setTimeout(()=>n.remove(),2200); }

/* ---------- pulihkan sesi (sementara, per tab) ---------- */
api.me().then(u => { if (u){ state.user = u; showApp(); } });
