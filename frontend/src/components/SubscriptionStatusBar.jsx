import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { getSubscriptionState } from '../utils/subscriptionGuard';

const CONFIGS = {
  expiring_soon: {
    bg:   'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-800',
    Icon: Clock,
  },
  in_grace: {
    bg:   'bg-orange-50 border-orange-200',
    text: 'text-orange-800',
    Icon: AlertTriangle,
  },
  locked: {
    bg:   'bg-red-50 border-red-200',
    text: 'text-red-800',
    Icon: XCircle,
  },
};

export default function SubscriptionStatusBar({ billingPath = '/billing' }) {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState(null);

  useEffect(() => {
    getSubscriptionState(user).then(setState);
  }, [user]);

  if (!state) return null;

  const cfg = CONFIGS[state.status];
  if (!cfg) return null; // 'active', blocking states handled by SubscriptionGuard

  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b text-sm font-medium
                     ${cfg.bg} ${cfg.text}`}>
      <cfg.Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 leading-snug">{state.message}</span>
      <Link
        to={billingPath}
        className="underline whitespace-nowrap shrink-0 font-semibold"
      >
        Renew
      </Link>
    </div>
  );
}
