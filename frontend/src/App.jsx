import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import useAdminStore from './store/adminStore';
import useAgentStore from './store/agentStore';

// Standard POS
import Layout from './components/Layout';
import SubscriptionGuard from './components/SubscriptionGuard';
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
import AgentsPage from './pages/admin/AgentsPage';
import CommissionManagementPage from './pages/admin/CommissionManagementPage';
import AgentLoginPage from './pages/agent/AgentLoginPage';
import AgentRegistrationPage from './pages/agent/AgentRegistrationPage';
import AgentPortalPage from './pages/agent/AgentPortalPage';

// Clothing module
import ClothingExchangesPage from './pages/ClothingExchangesPage';
import ClothingAnalyticsPage from './pages/ClothingAnalyticsPage';
import BranchManagementPage from './pages/BranchManagementPage';

// QR Display (public - customer-facing mobile page)
import QRDisplayPage from './pages/QRDisplayPage';

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
  if (!user) return <Navigate to="/login" replace />;
  return <SubscriptionGuard>{children}</SubscriptionGuard>;
}

function AdminRoute({ children }) {
  const token = useAdminStore((s) => s.token);
  return token ? children : <Navigate to="/admin/login" replace />;
}

function AgentRoute({ children }) {
  const token = useAgentStore((s) => s.token);
  return token ? children : <Navigate to="/agent/login" replace />;
}

/** Redirects to the right home page based on shop_type */
function ShopTypeIndex() {
  const user = useAuthStore((s) => s.user);
  if (user?.shop_type === 'car_wash') return <Navigate to="/carwash/dashboard" replace />;
  return <Navigate to="/pos" replace />;
}

/** Guards a route behind a feature flag - redirects home if flag is false */
function FeatureRoute({ feature, children }) {
  const user = useAuthStore((s) => s.user);
  if (user?.[feature] === false) return <Navigate to="/" replace />;
  return children;
}

/** Guards a route to a specific shop_type - redirects home if type doesn't match */
function ShopTypeRoute({ shopType, children }) {
  const user = useAuthStore((s) => s.user);
  if (user?.shop_type !== shopType) return <Navigate to="/" replace />;
  return children;
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
        <Route path="/login"      element={<LoginPage />} />
        <Route path="/scanner"    element={<ScannerPage />} />
        <Route path="/order"      element={<OrderPage />} />
        <Route path="/track"      element={<TrackOrderPage />} />
        <Route path="/cw-portal"  element={<CarWashPortal />} />
        <Route path="/qr-display" element={<QRDisplayPage />} />

        {/* ── Agent portal ──────────────────────────────────── */}
        <Route path="/agent/login"    element={<AgentLoginPage />} />
        <Route path="/agent/register" element={<AgentRegistrationPage />} />
        <Route
          path="/agent"
          element={
            <AgentRoute>
              <AgentPortalPage />
            </AgentRoute>
          }
        />

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
        <Route
          path="/admin/agents"
          element={
            <AdminRoute>
              <AgentsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/commissions"
          element={
            <AdminRoute>
              <CommissionManagementPage />
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
          <Route path="reports"     element={<FeatureRoute feature="reports_enabled"><ReportsPage /></FeatureRoute>} />
          <Route path="analytics"   element={<FeatureRoute feature="analytics_enabled"><AnalyticsPage /></FeatureRoute>} />
          <Route path="billing"     element={<BillingPage />} />
          <Route path="audit-log"   element={<AuditLogPage />} />
          <Route path="settings"    element={<SettingsPage />} />
          <Route path="pre-orders"  element={<FeatureRoute feature="pre_orders_enabled"><PreOrdersPage /></FeatureRoute>} />
          <Route path="customers"   element={<FeatureRoute feature="customers_enabled"><CustomersPage /></FeatureRoute>} />
          {/* Clothing module routes - also require correct shop type */}
          <Route path="exchanges"          element={<ShopTypeRoute shopType="clothing"><FeatureRoute feature="exchanges_enabled"><ClothingExchangesPage /></FeatureRoute></ShopTypeRoute>} />
          <Route path="clothing-analytics" element={<ShopTypeRoute shopType="clothing"><FeatureRoute feature="analytics_enabled"><ClothingAnalyticsPage /></FeatureRoute></ShopTypeRoute>} />
          <Route path="branches"           element={<ShopTypeRoute shopType="clothing"><FeatureRoute feature="branches_enabled"><BranchManagementPage /></FeatureRoute></ShopTypeRoute>} />
        </Route>

        {/* ── Car Wash module ───────────────────────────────── */}
        <Route
          path="/carwash"
          element={
            <PrivateRoute>
              <ShopTypeRoute shopType="car_wash">
                <CarWashLayout />
              </ShopTypeRoute>
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
