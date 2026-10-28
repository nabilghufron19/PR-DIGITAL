// Satu-satunya tempat frontend bicara dengan server (Cloudflare Pages Functions)
const call = async (url, method = 'GET', body) => {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  // Sesi habis / akun dinonaktifkan: beri tahu app.js agar kembali ke halaman login (login sendiri dikecualikan)
  if (r.status === 401 && !url.startsWith('/api/session')) window.dispatchEvent(new Event('sesi-habis'));
  if (!r.ok && !d.message) throw new Error(d.error || 'Terjadi kesalahan (' + r.status + ')');
  return d;
};
const crud = n => ({
  list: () => call('/api/' + n),
  add: b => call('/api/' + n, 'POST', b),
  set: (id, b) => call(`/api/${n}?id=${id}`, 'PUT', b),
  del: id => call(`/api/${n}?id=${id}`, 'DELETE')
});
const api = {
  login: (kode, username, password) => call('/api/session', 'POST', { kode, username, password }).catch(e => ({ ok: false, message: e.message })),
  daftarLembaga: () => call('/api/daftar-lembaga'),
  me: () => call('/api/session').then(u => (u.name ? u : null)).catch(() => null),
  sandi: (lama, baru) => call('/api/sandi', 'POST', { lama, baru }),
  logout: () => call('/api/session', 'DELETE').catch(() => {}),
  listPR: () => call('/api/pr'),
  togglePR: id => call('/api/pr', 'POST', { id }),
  soal: crud('soal'),
  murid: crud('murid'),
  guru: crud('guru'),
  lembaga: crud('lembaga'),
  tugas: {
    ...crud('tugas'),
    get: id => call('/api/tugas?id=' + id),
    status: (ids, status) => call('/api/tugas', 'PATCH', { ids, status }),
    setor: (ids, selesai) => call('/api/setor', 'POST', { ids, selesai })
  },
  monitor: () => call('/api/monitor')
};
