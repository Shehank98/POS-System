import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, CheckCircle, ChefHat, PackageCheck, XCircle, MessageCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { preOrdersApi } from '../api/client';

// ── Constants ─────────────────────────────────────────────────
const TABS = [
  { key: 'PENDING',    label: 'Pending',   icon: Clock,        color: 'text-yellow-600', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  { key: 'PREPARING',  label: 'Preparing', icon: ChefHat,      color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200'   },
  { key: 'READY',      label: 'Ready',     icon: PackageCheck, color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-200'  },
  { key: 'COMPLETED',  label: 'Completed', icon: CheckCircle,  color: 'text-gray-500',   bg: 'bg-gray-50',    border: 'border-gray-200'   },
];

const STATUS_ACTIONS = {
  PENDING:   [{ label: 'Mark Preparing', next: 'PREPARING', style: 'bg-blue-600 hover:bg-blue-700 text-white' }],
  PREPARING: [{ label: 'Mark Ready',     next: 'READY',     style: 'bg-green-600 hover:bg-green-700 text-white' }],
  READY:     [{ label: 'Complete Order', next: 'COMPLETED', style: 'bg-gray-800 hover:bg-gray-900 text-white' }],
  COMPLETED: [],
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

// ── Order Card ────────────────────────────────────────────────
function OrderCard({ order, onStatusChange, updating }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const actions = STATUS_ACTIONS[order.status] || [];

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
      {(actions.length > 0 || order.status !== 'COMPLETED') && (
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
          {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
            <button
              disabled={updating === order.id}
              onClick={() => onStatusChange(order.id, 'CANCELLED')}
              className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-sm transition-colors disabled:opacity-60"
              title="Cancel order"
            >
              <XCircle size={16} />
            </button>
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

// ── Main PreOrdersPage ────────────────────────────────────────
export default function PreOrdersPage() {
  const [activeTab, setActiveTab]   = useState('PENDING');
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const pollRef = useRef(null);

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

  // Initial fetch + auto-refresh every 15s for active tabs
  useEffect(() => {
    fetchOrders();
    if (pollRef.current) clearInterval(pollRef.current);
    if (activeTab !== 'COMPLETED') {
      pollRef.current = setInterval(() => fetchOrders(true), 15000);
    }
    return () => clearInterval(pollRef.current);
  }, [fetchOrders, activeTab]);

  const handleStatusChange = async (id, status) => {
    setUpdating(id);
    try {
      await preOrdersApi.updateStatus(id, status);
      toast.success(`Order marked as ${status.toLowerCase()}`);
      fetchOrders(true);
    } catch {
      toast.error('Failed to update order status');
    } finally {
      setUpdating(null);
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
          onClick={() => fetchOrders()}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors"
        >
          <RefreshCw size={13} /> {refreshLabel}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? `bg-white shadow ${tab.color}`
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{tab.label}</span>
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
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={handleStatusChange}
              updating={updating}
            />
          ))}
        </div>
      )}
    </div>
  );
}
