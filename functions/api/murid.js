// Data murid. Admin mengelola; guru hanya boleh membaca (untuk memilih sasaran tugas).
import { akun } from '../_lib/akun.js';
export const { onRequestGet, onRequestPost, onRequestPut, onRequestDelete } = akun('murid', ['admin', 'guru']);
