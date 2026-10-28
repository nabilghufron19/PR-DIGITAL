// Publik (tanpa login): daftar lembaga aktif untuk dropdown di halaman login.
// Lembaga platform tidak ikut ditampilkan; pilihannya ditambahkan statis di frontend.
import { route, json } from '../_lib/core.js';

export const onRequestGet = route(null, (_, __, sql) => sql`
  select kode, nama from lembaga
  where aktif and not platform
  order by nama`.then(json));
