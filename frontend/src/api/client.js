import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({ baseURL: BASE_URL });

// Attach JWT and device ID on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Device binding: generate once, persist forever
  let deviceId = localStorage.getItem('pos_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('pos_device_id', deviceId);
  }
  config.headers['X-Device-ID'] = deviceId;

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
  login:          (data) => client.post('/auth/login', data),
  me:             ()     => client.get('/auth/me'),
  registerUser:   (data) => client.post('/auth/register-user', data),
  listUsers:      ()     => client.get('/auth/users'),
  deleteUser:     (id)   => client.delete(`/auth/users/${id}`),
  updateSettings: (data) => client.put('/auth/settings', data),
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
  refund:  (id, data) => client.post(`/transactions/${id}/refund`, data),
  sync:    (txns)   => client.post('/transactions/sync', { transactions: txns }),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
  today:     ()              => client.get('/dashboard/today'),
  yesterday: ()              => client.get('/dashboard/yesterday'),
  week:      ()              => client.get('/dashboard/week'),
  month:     ()              => client.get('/dashboard/month'),
  lowStock:  (threshold = 10) => client.get('/dashboard/low-stock', { params: { threshold } }),
};

// ── Reports ───────────────────────────────────────────────────
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
  taxReport: (startDate, endDate) =>
    client.get('/reports/tax', { params: { start_date: startDate, end_date: endDate } }),
};

// ── Analytics (shop-level) ────────────────────────────────────
export const analyticsApi = {
  get: (params) => client.get('/dashboard/analytics', { params }),
};

// ── Notifications ─────────────────────────────────────────────
export const notificationsApi = {
  list:       ()   => client.get('/notifications'),
  markRead:   (id) => client.put(`/notifications/${id}/read`),
  markAllRead: ()  => client.put('/notifications/read-all'),
};

// ── Audit Log (shop-level) ────────────────────────────────────
export const auditApi = {
  list: (params) => client.get('/audit-log', { params }),
};

// ── Payments (shop subscription payments) ────────────────────
export const paymentsApi = {
  bankInfo: () => client.get('/payments/bank-info'),
  list:     () => client.get('/payments'),
  submit:   (data) => client.post('/payments', data),
};

// ── Pre-Orders ───────────────────────────────────────────────
// Public endpoints use plain axios (no auth header needed)
const publicClient = axios.create({ baseURL: BASE_URL });

export const preOrdersApi = {
  // Public — customer ordering (no auth)
  getProducts:          (shopId)        => publicClient.get(`/pre-orders/public/products?shop_id=${shopId}`),
  getShop:              (shopId)        => publicClient.get(`/pre-orders/public/shop?shop_id=${shopId}`),
  create:               (data)          => publicClient.post('/pre-orders/public', data),
  getHistory:           (shopId, phone) => publicClient.get(`/pre-orders/public/history?shop_id=${shopId}&phone=${encodeURIComponent(phone)}`),
  trackOrder:           (shopId, token) => publicClient.get(`/pre-orders/public/track?shop_id=${shopId}&token=${encodeURIComponent(token)}`),
  getCancellationStatus:(shopId, phone) => publicClient.get(`/pre-orders/public/cancellation-status?shop_id=${shopId}&phone=${encodeURIComponent(phone)}`),
  cancelOrder:         (data)          => publicClient.post('/pre-orders/public/cancel', data),
  // Authenticated — shop owner / POS staff
  list:         (status)        => client.get('/pre-orders', { params: status ? { status } : {} }),
  getCounts:    ()              => client.get('/pre-orders/counts'),
  updateStatus: (id, status)    => client.put(`/pre-orders/${id}/status`, { status }),
  markAsPaid:   (id)            => client.put(`/pre-orders/${id}/pay`),
  getByToken:   (token)         => client.get(`/pre-orders/by-token/${encodeURIComponent(token)}`),
  getStats:     ()              => client.get('/pre-orders/stats'),
};

// ── Customers (owner insights) ────────────────────────────────
export const customersApi = {
  getTop:      (limit = 20)  => client.get('/customers/top', { params: { limit } }),
  getInsights: (phone)       => client.get('/customers/insights', { params: { phone } }),
};

// ── Car Wash (authenticated) ──────────────────────────────────
export const carwashApi = {
  dashboard:           ()            => client.get('/carwash/dashboard'),
  staffView:           ()            => client.get('/carwash/staff/my-view'),
  // services
  listServices:        (p)           => client.get('/carwash/services', { params: p }),
  createService:       (data)        => client.post('/carwash/services', data),
  updateService:       (id, data)    => client.put(`/carwash/services/${id}`, data),
  deleteService:       (id)          => client.delete(`/carwash/services/${id}`),
  // products
  listProducts:        (p)           => client.get('/carwash/products', { params: p }),
  createProduct:       (data)        => client.post('/carwash/products', data),
  updateProduct:       (id, data)    => client.put(`/carwash/products/${id}`, data),
  deleteProduct:       (id)          => client.delete(`/carwash/products/${id}`),
  // jobs
  listJobs:            (params)      => client.get('/carwash/jobs', { params }),
  getJob:              (id)          => client.get(`/carwash/jobs/${id}`),
  createJob:           (data)        => client.post('/carwash/jobs', data),
  updateJobStatus:     (id, status, staffId) => client.put(`/carwash/jobs/${id}/status`, { status, assigned_staff_id: staffId }),
  addJobItem:          (id, data)    => client.post(`/carwash/jobs/${id}/items`, data),
  removeJobItem:       (id, itemId)  => client.delete(`/carwash/jobs/${id}/items/${itemId}`),
  payJob:              (id, data)    => client.post(`/carwash/jobs/${id}/pay`, data),
  // bookings
  listBookings:        (params)      => client.get('/carwash/bookings', { params }),
  createBooking:       (data)        => client.post('/carwash/bookings', data),
  updateBooking:       (id, data)    => client.put(`/carwash/bookings/${id}`, data),
  updateBookingStatus: (id, status)  => client.put(`/carwash/bookings/${id}/status`, { status }),
  convertBooking:      (id)          => client.post(`/carwash/bookings/${id}/convert`),
};

// ── Clothing Module ───────────────────────────────────────────
export const clothingApi = {
  // Products
  listProducts:       (params)       => client.get('/clothing/products', { params }),
  getProduct:         (id)           => client.get(`/clothing/products/${id}`),
  createProduct:      (data)         => client.post('/clothing/products', data),
  updateProduct:      (id, data)     => client.put(`/clothing/products/${id}`, data),
  deleteProduct:      (id)           => client.delete(`/clothing/products/${id}`),
  // Variants
  listVariants:       (pid)          => client.get(`/clothing/products/${pid}/variants`),
  createVariant:      (pid, data)    => client.post(`/clothing/products/${pid}/variants`, data),
  updateVariant:      (id, data)     => client.put(`/clothing/variants/${id}`, data),
  deleteVariant:      (id)           => client.delete(`/clothing/variants/${id}`),
  getVariantByBarcode:(barcode)      => client.get(`/clothing/variants/by-barcode/${encodeURIComponent(barcode)}`),
  // Stock
  adjustStock:        (id, data)     => client.post(`/clothing/variants/${id}/adjust`, data),
  getStockHistory:    (id)           => client.get(`/clothing/variants/${id}/stock-history`),
  getLowStock:        ()             => client.get('/clothing/variants/low-stock'),
  // Barcode labels PDF
  getBarcodeLabels:   (ids)          => client.get('/clothing/variants/labels', { params: { ids }, responseType: 'blob' }),
  // Exchanges / Returns
  lookupTransaction:  (params)       => client.get('/clothing/transactions/lookup', { params }),
  processExchange:    (data)         => client.post('/clothing/exchanges', data),
  listExchanges:      (params)       => client.get('/clothing/exchanges', { params }),
  getExchange:        (id)           => client.get(`/clothing/exchanges/${id}`),
  openExchangeReceipt:(id)           => {
    const token = localStorage.getItem('pos_token') || '';
    const url   = `${BASE_URL}/clothing/exchanges/${id}/receipt?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank', 'width=500,height=700,noopener');
  },
  // Refund vouchers
  checkVoucher:       (code)         => client.get(`/clothing/vouchers/${encodeURIComponent(code)}`),
  // Reports
  dashboard:          ()             => client.get('/clothing/dashboard'),
  bestSizes:          (params)       => client.get('/clothing/reports/best-sizes', { params }),
  bestColors:         (params)       => client.get('/clothing/reports/best-colors', { params }),
  dailySales:         (params)       => client.get('/clothing/reports/daily-sales', { params }),
  // Branches
  listBranches:       ()             => client.get('/clothing/branches'),
  createBranch:       (data)         => client.post('/clothing/branches', data),
  updateBranch:       (id, data)     => client.put(`/clothing/branches/${id}`, data),
  getBranchInventory: (id)           => client.get(`/clothing/branches/${id}/inventory`),
  transferStock:      (data)         => client.post('/clothing/branches/transfer', data),
  // Loyalty / Customers
  getCustomer:        (phone)        => client.get('/clothing/customers/lookup', { params: { phone } }),
  upsertCustomer:     (data)         => client.post('/clothing/customers', data),
};

// ── Car Wash Public (no auth — customer portal) ───────────────
export const carwashPublicApi = {
  lookup:        (shopId, phone, vehicle) =>
    publicClient.get('/carwash/public/lookup', { params: { shop_id: shopId, phone, vehicle } }),
  shopInfo:      (shopId) =>
    publicClient.get('/carwash/public/shop-info', { params: { shop_id: shopId } }),
  createBooking: (data)   => publicClient.post('/carwash/public/bookings', data),
};

// ── Admin API (uses separate admin token) ────────────────────
const adminClient = axios.create({ baseURL: BASE_URL });
adminClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
adminClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pos_admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export const adminApi = {
  login:          (data) => adminClient.post('/admin/login', data),
  dashboard:      ()     => adminClient.get('/admin/dashboard'),
  listShops:      ()     => adminClient.get('/admin/shops'),
  createShop:     (data) => adminClient.post('/admin/shops', data),
  updateShop:     (id, data) => adminClient.put(`/admin/shops/${id}`, data),
  updateSub:      (id, data) => adminClient.put(`/admin/shops/${id}/subscription`, data),
  listPayments:   ()     => adminClient.get('/admin/payments'),
  getProof:       (id)   => adminClient.get(`/admin/payments/${id}/proof`),
  verifyPayment:  (id)   => adminClient.put(`/admin/payments/${id}/verify`),
  rejectPayment:  (id, data) => adminClient.put(`/admin/payments/${id}/reject`, data),
  getAnalysis:      (params)            => adminClient.get('/admin/analysis',  { params }),
  getAuditLog:      (params)            => adminClient.get('/admin/audit-log', { params }),
  getShopUsers:     (shopId)            => adminClient.get(`/admin/shops/${shopId}/users`),
  changeUserPw:     (shopId, userId, pw) => adminClient.put(`/admin/shops/${shopId}/users/${userId}/password`, { new_password: pw }),
};

export default client;
