import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({ baseURL: BASE_URL });

// Attach JWT on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear storage and redirect to login
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  login:        (data) => client.post('/auth/login', data),
  me:           ()     => client.get('/auth/me'),
  registerUser: (data) => client.post('/auth/register-user', data),
  listUsers:    ()     => client.get('/auth/users'),
  deleteUser:   (id)   => client.delete(`/auth/users/${id}`),
};

// ── Products ─────────────────────────────────────────────────
export const productsApi = {
  list:       (params) => client.get('/products', { params }),
  getById:    (id)     => client.get(`/products/${id}`),
  byBarcode:  (code)   => client.get(`/products/by-barcode/${code}`),
  categories: ()       => client.get('/products/categories'),
  create:     (data)   => client.post('/products', data),
  update:     (id, data) => client.put(`/products/${id}`, data),
  delete:     (id)     => client.delete(`/products/${id}`),
};

// ── Transactions ─────────────────────────────────────────────
export const transactionsApi = {
  list:    (params) => client.get('/transactions', { params }),
  get:     (id)     => client.get(`/transactions/${id}`),
  summary: (params) => client.get('/transactions/summary', { params }),
  create:  (data)   => client.post('/transactions', data),
  void:    (id)     => client.post(`/transactions/${id}/void`),
  sync:    (txns)   => client.post('/transactions/sync', { transactions: txns }),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
  today:    ()              => client.get('/dashboard/today'),
  week:     ()              => client.get('/dashboard/week'),
  month:    ()              => client.get('/dashboard/month'),
  lowStock: (threshold = 10) => client.get('/dashboard/low-stock', { params: { threshold } }),
};

// ── Reports (file downloads – return raw Blob) ────────────────
export const reportsApi = {
  sales: async (startDate, endDate, format = 'excel') => {
    const res = await client.get('/reports/sales', {
      params:       { start_date: startDate, end_date: endDate, format },
      responseType: 'blob',
    });
    return res.data;
  },
  inventory: async () => {
    const res = await client.get('/reports/inventory', { responseType: 'blob' });
    return res.data;
  },
};

export default client;
