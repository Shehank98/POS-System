import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import useAdminStore from './store/adminStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import POSPage from './pages/POSPage';
import TransactionsPage from './pages/TransactionsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import BillingPage from './pages/BillingPage';
import AuditLogPage from './pages/AuditLogPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ScannerPage from './pages/ScannerPage';
import OrderPage from './pages/OrderPage';
import TrackOrderPage from './pages/TrackOrderPage';
import PreOrdersPage from './pages/PreOrdersPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';

function PrivateRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const token = useAdminStore((s) => s.token);
  return token ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { fontSize: '14px' },
        }}
      />
      <Routes>
        {/* Public routes (no auth required) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/scanner" element={<ScannerPage />} />
        <Route path="/order" element={<OrderPage />} />
        <Route path="/track" element={<TrackOrderPage />} />

        {/* Admin section */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />

        {/* Shop app (requires shop auth) */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index              element={<Navigate to="/pos" replace />} />
          <Route path="pos"         element={<POSPage />} />
          <Route path="dashboard"   element={<DashboardPage />} />
          <Route path="products"    element={<ProductsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="reports"     element={<ReportsPage />} />
          <Route path="analytics"   element={<AnalyticsPage />} />
          <Route path="billing"     element={<BillingPage />} />
          <Route path="audit-log"   element={<AuditLogPage />} />
          <Route path="settings"    element={<SettingsPage />} />
          <Route path="pre-orders"  element={<PreOrdersPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
