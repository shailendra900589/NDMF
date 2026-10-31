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
    const url = err.config?.url || '';
    const isAuthAttempt =
      url.includes('/auth/login') ||
      url.includes('/auth/otp/');
    if (err.response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem('ndfa_token');
      localStorage.removeItem('ndfa_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    const payload = err.response?.data;
    return Promise.reject(
      { ...(payload || {}), status: err.response?.status, message: payload?.message || err.message || 'Request failed' }
    );
  }
);

export const authApi = {
  login: (loginId, password) =>
    api.post('/auth/login', { loginId, mobile: loginId, password }),
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
  resetFace: (id) => api.delete(`/users/${id}/face-enrollment`),
  remove: (id) => api.delete(`/users/${id}`),
  getPermissionSchema: () => api.get('/users/permission-schema'),
};

export const branchesApi = {
  getAll: () => api.get('/branches'),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  remove: (id) => api.delete(`/branches/${id}`),
};

export const customersApi = {
  reverify: (id, reason) => api.post(`/customers/${id}/reverify`, { reason }),
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
};
export const leadsApi = { getAll: (params) => api.get('/leads', { params }) };

export const attendanceApi = {
  setSalary:(userId,data)=>api.put(`/attendance/salary/${userId}`,data),
  adjust: data=>api.put('/attendance/adjustment',data),
  getEnrollment: userId => api.get(`/attendance/enrollment/${encodeURIComponent(userId)}`),
  getHistory: () => api.get('/attendance/history'),
  getMonthly: (params) => api.get('/attendance/monthly', { params }),
  getOperations: () => api.get('/attendance/operations'),
  saveSchedule: data => api.put('/attendance/schedules', data),
  removeSchedule: id => api.delete(`/attendance/schedules/${id}`),
  saveFestival: data => api.post('/attendance/festivals', data),
  removeFestival: id => api.delete(`/attendance/festivals/${id}`),
};

export const trackingApi = {
  getHistory: () => api.get('/tracking/history'),
  getToday: () => api.get('/tracking/today'),
  getLive: () => api.get('/tracking/live'),
  getRoute: (params) => api.get('/tracking/route', { params }),
  getPeople: () => api.get('/tracking/people'),
  getDays: (params) => api.get('/tracking/days', { params }),
};

export const callLogsApi = {
  getAll: () => api.get('/call-logs'),
};

export async function uploadMedia(file, fields = {}) {
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value != null && value !== '') body.append(key, String(value));
  });
  body.append('file', file);
  const res = await api.post('/uploads/single', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export const listingsApi = {
  getAll: (params) => api.get('/customer-listings', { params }),
  getById: (id) => api.get(`/customer-listings/${id}`),
  create: (data) => api.post('/customer-listings', data),
  approve: (data) => api.post('/customer-listings/approve', data),
  remove: (id) => api.delete(`/customer-listings/${id}`),
};

export const payslipsApi = {
  release: (id,data)=>api.put(`/payslips/${id}/release`,data),
  calculation:params=>api.get('/payslips/calculation',{params}),
  runPayroll: data => api.post('/payslips/run', data),
  getAll: (params) => api.get('/payslips', { params }),
  getById: (id) => api.get(`/payslips/${id}`),
  create: (data) => api.post('/payslips', data),
  update: (id, data) => api.put(`/payslips/${id}`, data),
  bulkUpsert: (data) => api.post('/payslips/bulk', data),
  addMonth: (id, data) => api.post(`/payslips/${id}/add-month`, data),
  remove: (id) => api.delete(`/payslips/${id}`),
};

export const platformApi = {
  overview: () => api.get('/super-admin/overview'),
  createCompany: data => api.post('/super-admin/companies', data),
  updateCompany: (id, data) => api.put(`/super-admin/companies/${id}`, data),
  users: id => api.get(`/super-admin/companies/${id}/users`),
  createUser: (id, data) => api.post(`/super-admin/companies/${id}/users`, data),
  updateUser: (id, userId, data) => api.put(`/super-admin/companies/${id}/users/${userId}`, data),
};

export default api;

export const developerApi = { overview: () => api.get("/developer/manage"), action: (path, data = {}) => api.post(`/developer/manage/${path}`, data) };
export const packageApi = {overview:()=>api.get('/super-admin/packages'),create:data=>api.post('/super-admin/packages',data),update:(id,data)=>api.put(`/super-admin/packages/${id}`,data),assign:(id,data)=>api.post(`/super-admin/packages/assign/${id}`,data),requestStatus:(id,status)=>api.put(`/super-admin/packages/requests/${id}/status`,{status})};
