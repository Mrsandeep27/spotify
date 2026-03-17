import { API_BASE_URL } from '../config/api';
import { AuthService } from './authService';

async function adminFetch(path, options = {}) {
  const token = await AuthService.getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Admin request failed');
  return data;
}

export const AdminService = {
  getPendingUsers: () => adminFetch('/api/admin/pending'),
  getAllUsers: () => adminFetch('/api/admin/users'),
  getLoginHistory: (limit = 100) => adminFetch(`/api/admin/logins?limit=${limit}`),
  approveUser: (id) => adminFetch(`/api/admin/users/${id}/approve`, { method: 'POST' }),
  rejectUser: (id) => adminFetch(`/api/admin/users/${id}/reject`, { method: 'POST' }),
  getUserDetail: (id) => adminFetch(`/api/admin/users/${id}`),
};
