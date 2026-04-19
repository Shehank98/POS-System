import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, CheckCircle, ChefHat, PackageCheck, XCircle, MessageCircle, RefreshCw, Ban, CreditCard, CheckCheck, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { preOrdersApi } from '../api/client';
import QRPaymentModal from '../components/QRPaymentModal';

// ── Constants ─────────────────────────────────────────────────
const TABS = [
  { key: 'PENDING',    label: 'Pending',   icon: Clock,        color: 'text-yellow-600', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  { key: 'PREPARING',  label: 'Preparing', icon: ChefHat,      color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200'   },
  { key: 'READY',      label: 'Ready',     icon: PackageCheck, color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-200'  },
  { key: 'COMPLETED',  label: 'Completed', icon: CheckCircle,  color: 'text-gray-500',   bg: 'bg-gray-50',    border: 'border-gray-200'   },
  { key: 'CANCELLED',  label: 'Cancelled', icon: Ban,          color: 'text-red-500',    bg: 'bg-red-50',     border: 'border-red-200'    },
];

const STATUS_ACTIONS = {
  PENDING:   [{ label: 'Mark Preparing', next: 'PREPARING', style: 'bg-blue-600 hover:bg-blue-700 text-white' }],
  PREPARING: [{ label: 'Mark Ready',     next: 'READY',     style: 'bg-green-600 hover:bg-green-700 text-white' }],
  READY:     [{ label: 'Complete Order', next: 'COMPLETED', style: 'bg-gray-800 hover:bg-gray-900 text-white' }],
  COMPLETED: [],
  CANCELLED: [],
};

// ── Helpers ───────────────────────────────────────────────────
function elapsed(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function ageColor(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (mins < 15) return 'bg-green-100 border-green-300 text-green-800';
  if (mins < 30) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
  return 'bg-red-100 border-red-300 text-red-800';
}

// ── Payment badge ─────────────────────────────────────────────
function PaymentBadge({ status }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCheck size={10} /> Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
      <CreditCard size={10} /> Unpaid
    </span>
  );
}

// ── Order Card ────────────────────────────────────────────────
function OrderCard({ order, onStatusChange, onMarkPaid, onQRSuccess, updating, markingPaid }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const items = Array.isArray(order.items) ? order.items : [];
  const actions = STATUS_ACTIONS[order.status] || [];
  const isPaid = order.payment_status === 'paid';

  const waLink = `https://wa.me/${order.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hi ${order.customer_name || ''}! Your order token ${order.token_number} is ready for pickup. Please visit us to pay and collect. Thank you!`
  )}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Token header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${ageColor(order.created_at)}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Token</p>
          <p className="text-3xl font-black tracking-wider leading-none">{order.token_number}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 mb-0.5">
            <PaymentBadge status={order.payment_status || 'pending'} />
          </div>
          <p className="text-xs opacity-70 flex items-center gap-1 justify-end">
            <Clock size={11} /> {elapsed(order.created_at)}
          </p>
          {order.customer_name && (
            <p className="text-sm font-medium mt-0.5">{order.customer_name}</p>
          )}
          <p className="text-xs opacity-80">{order.customer_phone}</p>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3">
        <ul className="space-y-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex justify-between text-sm text-gray-700">
              <span>{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
              <span>Rs {(Number(item.price) * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-bold text-gray-800 border-t border-gray-100 mt-2 pt-2">
          <span>Total</span>
          <span>Rs {Number(order.total_amount).toFixed(2)}</span>
        </div>
      </div>

      {/* Actions */}
      {(actions.length > 0 || (order.status !== 'COMPLETED' && order.status !== 'CANCELLED') || !isPaid) && (
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.next}
              disabled={updating === order.id}
              onClick={() => onStatusChange(order.id, action.next)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${action.style}`}
            >
              {updating === order.id ? 'Updating...' : action.label}
            </button>
          ))}

          {/* Mark as Paid + Charge via QR — shown when not yet paid and order is active */}
          {!isPaid && order.status !== 'CANCELLED' && (
            <>
              <button
                disabled={markingPaid === order.id}
                onClick={() => onMarkPaid(order.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                title="Mark as paid (cash/card)"
              >
                <CreditCard size={14} />
                {markingPaid === order.id ? 'Marking...' : 'Mark Paid'}
              </button>
              <button
                onClick={() => setShowQR(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                title="Charge via LankaQR"
              >
                <QrCode size={14} /> Charge QR
              </button>
              {showQR && (
                <QRPaymentModal
                  amount={Number(order.total_amount)}
                  sessionType="preorder"
                  preOrderId={order.id}
                  onClose={() => setShowQR(false)}
                  onSuccess={() => { setShowQR(false); onQRSuccess(order.id); }}
                />
              )}
            </>
          )}

          {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
            !confirmCancel ? (
              <button
                disabled={updating === order.id}
                onClick={() => setConfirmCancel(true)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-400
                           hover:bg-red-50 hover:text-red-500 hover:border-red-200
                           text-sm transition-colors disabled:opacity-60"
                title="Cancel order"
              >
                <XCircle size={16} />
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-1 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="text-xs text-red-700 font-medium flex-1">
                  Cancel <strong>{order.token_number}</strong>?
                </span>
                <button
                  onClick={() => { setConfirmCancel(false); onStatusChange(order.id, 'CANCELLED'); }}
                  className="px-2.5 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="px-2.5 py-1 text-xs border border-gray-300 bg-white rounded-lg text-gray-500 hover:bg-gray-50"
                >
                  Keep
                </button>
              </div>
            )
          )}

          {/* WhatsApp notify — visible on READY status */}
          {order.status === 'READY' && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm font-medium"
              title="Notify customer via WhatsApp"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notification badge ────────────────────────────────────────
function TabBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                     rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ── Main PreOrdersPage ────────────────────────────────────────
export default function PreOrdersPage() {
  const [activeTab,    setActiveTab]   = useState('PENDING');
  const [orders,       setOrders]      = useState([]);
  const [counts,       setCounts]      = useState({ PENDING: 0, PREPARING: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 });
  const [loading,      setLoading]     = useState(true);
  const [updating,     setUpdating]    = useState(null);
  const [markingPaid,  setMarkingPaid] = useState(null);
  const [lastRefresh,  setLastRefresh] = useState(Date.now());
  const pollRef   = useRef(null);
  const countRef  = useRef(null);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await preOrdersApi.getCounts();
      setCounts(res.data);
    } catch { /* silent */ }
  }, []);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await preOrdersApi.list(activeTab);
      setOrders(res.data.orders || []);
      setLastRefresh(Date.now());
    } catch {
      if (!silent) toast.error('Failed to load pre-orders');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Initial fetch + polling for active tabs
  useEffect(() => {
    fetchOrders();
    fetchCounts();

    if (pollRef.current) clearInterval(pollRef.current);
    if (countRef.current) clearInterval(countRef.current);

    if (activeTab !== 'COMPLETED' && activeTab !== 'CANCELLED') {
      pollRef.current = setInterval(() => fetchOrders(true), 15000);
    }
    // Always refresh counts every 15s
    countRef.current = setInterval(fetchCounts, 15000);

    return () => {
      clearInterval(pollRef.current);
      clearInterval(countRef.current);
    };
  }, [fetchOrders, fetchCounts, activeTab]);

  const handleStatusChange = async (id, status) => {
    setUpdating(id);
    try {
      await preOrdersApi.updateStatus(id, status);
      toast.success(`Order marked as ${status.toLowerCase()}`);
      fetchOrders(true);
      fetchCounts();
    } catch {
      toast.error('Failed to update order status');
    } finally {
      setUpdating(null);
    }
  };

  const handleMarkPaid = async (id) => {
    setMarkingPaid(id);
    try {
      await preOrdersApi.markAsPaid(id);
      toast.success('Order marked as paid');
      fetchOrders(true);
    } catch {
      toast.error('Failed to mark as paid');
    } finally {
      setMarkingPaid(null);
    }
  };

  const secs = Math.floor((Date.now() - lastRefresh) / 1000);
  const refreshLabel = secs < 5 ? 'Just refreshed' : `${secs}s ago`;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Pre-Orders</h1>
        <button
          onClick={() => { fetchOrders(); fetchCounts(); }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors"
        >
          <RefreshCw size={13} /> {refreshLabel}
        </button>
      </div>

      {/* Tabs with notification badges */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const badgeCount = counts[tab.key] || 0;
          const isActive = activeTab === tab.key;
          // Highlight Preparing and Ready tabs if they have orders
          const hasNewOrders = (tab.key === 'PREPARING' || tab.key === 'READY') && badgeCount > 0 && !isActive;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                isActive
                  ? `bg-white shadow ${tab.color}`
                  : hasNewOrders
                    ? 'text-gray-700 bg-white/60 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{tab.label}</span>
              <TabBadge count={badgeCount} />
            </button>
          );
        })}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <PackageCheck size={48} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No {activeTab.toLowerCase()} orders</p>
          {activeTab === 'PENDING' && (
            <p className="text-sm mt-1">New orders will appear here automatically</p>
          )}
          {activeTab === 'CANCELLED' && (
            <p className="text-sm mt-1">No cancelled orders today</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={handleStatusChange}
              onMarkPaid={handleMarkPaid}
              onQRSuccess={(id) => { preOrdersApi.markAsPaid(id).then(() => { toast.success('QR payment confirmed — order marked paid'); fetchOrders(true); fetchCounts(); }).catch(() => toast.error('Payment received but failed to mark paid')); }}
              updating={updating}
              markingPaid={markingPaid}
            />
          ))}
        </div>
      )}
    </div>
  );
}
