/**
 * API CLIENT — same-origin /api/v1 behind nginx (works on IP + domain)
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ndfa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ndfa_token');
      localStorage.removeItem('ndfa_user');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

export const authApi = {
  login: (mobile, password, role) =>
    api.post('/auth/login', role ? { mobile, password, role } : { mobile, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (oldPassword, newPassword) =>
    api.put('/auth/change-password', { oldPassword, newPassword }),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};

export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  getPermissionSchema: () => api.get('/users/permission-schema'),
};

export const branchesApi = {
  getAll: () => api.get('/branches'),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
};

export const customersApi = {
  getAll: (params) => api.get('/customers', { params }),
};

export const attendanceApi = {
  getHistory: () => api.get('/attendance/history'),
  getMonthly: (params) => api.get('/attendance/monthly', { params }),
};

export const trackingApi = {
  getHistory: () => api.get('/tracking/history'),
  getToday: () => api.get('/tracking/today'),
};

export const callLogsApi = {
  getAll: () => api.get('/call-logs'),
};

export const listingsApi = {
  getAll: (params) => api.get('/customer-listings', { params }),
  getById: (id) => api.get(`/customer-listings/${id}`),
};

export default api;
