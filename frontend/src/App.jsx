import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ProductsPage from './pages/ProductsPage';
import POSPage from './pages/POSPage';
import TransactionsPage from './pages/TransactionsPage';
import SettingsPage from './pages/SettingsPage';

function ComingSoon({ title }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-2">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm">Coming in the next phase</p>
    </div>
  );
}

function PrivateRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  return user ? children : <Navigate to="/login" replace />;
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
        <Route path="/login" element={<LoginPage />} />

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
          <Route path="products"    element={<ProductsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="reports"     element={<ComingSoon title="Reports" />} />
          <Route path="settings"    element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
