import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import useAdminStore from './store/adminStore';

// Standard POS
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
import CustomersPage from './pages/CustomersPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';

// Clothing module
import ClothingExchangesPage from './pages/ClothingExchangesPage';
import ClothingAnalyticsPage from './pages/ClothingAnalyticsPage';
import BranchManagementPage from './pages/BranchManagementPage';

// Car Wash module
import CarWashLayout from './components/CarWashLayout';
import CarWashDashboard from './pages/carwash/CarWashDashboard';
import CarWashJobList from './pages/carwash/CarWashJobList';
import CarWashJobCreate from './pages/carwash/CarWashJobCreate';
import CarWashJobDetail from './pages/carwash/CarWashJobDetail';
import CarWashBookings from './pages/carwash/CarWashBookings';
import CarWashServices from './pages/carwash/CarWashServices';
import CarWashProducts from './pages/carwash/CarWashProducts';
import CarWashStaffView from './pages/carwash/CarWashStaffView';
import CarWashPortal from './pages/CarWashPortal';

function PrivateRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const token = useAdminStore((s) => s.token);
  return token ? children : <Navigate to="/admin/login" replace />;
}

/** Redirects to the right home page based on shop_type */
function ShopTypeIndex() {
  const user = useAuthStore((s) => s.user);
  if (user?.shop_type === 'car_wash') return <Navigate to="/carwash/dashboard" replace />;
  return <Navigate to="/pos" replace />;
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
        {/* ── Public routes ─────────────────────────────────── */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/scanner"  element={<ScannerPage />} />
        <Route path="/order"    element={<OrderPage />} />
        <Route path="/track"    element={<TrackOrderPage />} />
        <Route path="/cw-portal" element={<CarWashPortal />} />

        {/* ── Admin section ─────────────────────────────────── */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />

        {/* ── Standard POS (retail + other types) ───────────── */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index              element={<ShopTypeIndex />} />
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
          <Route path="customers"   element={<CustomersPage />} />
          {/* Clothing module routes */}
          <Route path="exchanges"          element={<ClothingExchangesPage />} />
          <Route path="clothing-analytics" element={<ClothingAnalyticsPage />} />
          <Route path="branches"           element={<BranchManagementPage />} />
        </Route>

        {/* ── Car Wash module ───────────────────────────────── */}
        <Route
          path="/carwash"
          element={
            <PrivateRoute>
              <CarWashLayout />
            </PrivateRoute>
          }
        >
          <Route index                element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"     element={<CarWashDashboard />} />
          <Route path="jobs"          element={<CarWashJobList />} />
          <Route path="jobs/new"      element={<CarWashJobCreate />} />
          <Route path="jobs/:id"      element={<CarWashJobDetail />} />
          <Route path="bookings"      element={<CarWashBookings />} />
          <Route path="services"      element={<CarWashServices />} />
          <Route path="products"      element={<CarWashProducts />} />
          <Route path="staff"         element={<CarWashStaffView />} />
          <Route path="billing"       element={<BillingPage />} />
          <Route path="settings"      element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
