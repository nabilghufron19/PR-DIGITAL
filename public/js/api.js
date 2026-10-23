// Satu-satunya tempat frontend bicara dengan server (Cloudflare Pages Functions)
const call = async (url, method = 'GET', body) => {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
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
  login: (username, password) => call('/api/session', 'POST', { username, password }).catch(e => ({ ok: false, message: e.message })),
  me: () => call('/api/session').then(u => (u.name ? u : null)).catch(() => null),
  logout: () => call('/api/session', 'DELETE').catch(() => {}),
  listPR: () => call('/api/pr'),
  togglePR: id => call('/api/pr', 'POST', { id }),
  soal: crud('soal'),
  murid: crud('murid'),
  tugas: {
    list: () => call('/api/tugas'),
    assign: b => call('/api/tugas', 'POST', b),
    status: (ids, status) => call('/api/tugas', 'PATCH', { ids, status })
  },
  monitor: () => call('/api/monitor')
};
