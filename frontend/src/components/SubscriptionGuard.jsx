import { useEffect, useState, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { getSubscriptionState, recordRunTimestamp } from '../utils/subscriptionGuard';

function BlockingOverlay({ icon, title, message, showRetry, onRetry }) {
  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/95 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
        <div className="text-5xl">{icon}</div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        {showRetry && (
          <button
            onClick={onRetry}
            className="btn-primary w-full justify-center"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

export default function SubscriptionGuard({ children }) {
  const user        = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const location    = useLocation();
  const [state, setState] = useState(null);

  // Unactivated shops can only access billing (covers 'inactive' and any future non-active states)
  const isInactive = user?.activation_status != null && user.activation_status !== 'active';
  const onBilling  = location.pathname === '/billing' || location.pathname === '/carwash/billing';
  if (isInactive && !onBilling) {
    const billingPath = user?.shop_type === 'car_wash' ? '/carwash/billing' : '/billing';
    return <Navigate to={billingPath} replace />;
  }

  const check = useCallback(async () => {
    await recordRunTimestamp();
    const s = await getSubscriptionState(user);
    setState(s);
  }, [user]);

  useEffect(() => {
    check();
    const id = setInterval(check, 5 * 60 * 1000); // re-check every 5 minutes
    return () => clearInterval(id);
  }, [check]);

  async function handleRetry() {
    if (navigator.onLine) await refreshUser();
    await check();
  }

  // While determining state — render children to avoid flash on every route change
  if (!state) return children;

  if (state.status === 'time_tampered') {
    return (
      <BlockingOverlay
        icon="⏰"
        title="System Time Manipulation Detected"
        message="Your device time appears to have been changed backwards. Please correct your device time and restart the application."
      />
    );
  }

  if (state.status === 'needs_online') {
    return (
      <BlockingOverlay
        icon="📡"
        title="Online Verification Required"
        message={state.message}
        showRetry
        onRetry={handleRetry}
      />
    );
  }

  if (state.status === 'suspended') {
    return (
      <BlockingOverlay
        icon="🚫"
        title="Account Suspended"
        message="This account has been suspended. Please contact support to resolve this."
      />
    );
  }

  // 'locked', 'in_grace', 'expiring_soon', 'active' — render children
  // SubscriptionStatusBar handles the visual warning for these states
  return children;
}
