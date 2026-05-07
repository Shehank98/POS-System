import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Clock, ChefHat, PackageCheck, XCircle, RefreshCw, ArrowLeft, CreditCard, CheckCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { preOrdersApi } from '../api/client';

// ── Status config ─────────────────────────────────────────────
const STEPS = [
  {
    key:     'PENDING',
    label:   'Received',
    icon:    Clock,
    message: 'Your order has been received. We\'ll start preparing soon.',
    color:   'text-yellow-600',
    bg:      'bg-yellow-100',
    ring:    'ring-yellow-400',
  },
  {
    key:     'PREPARING',
    label:   'Preparing',
    icon:    ChefHat,
    message: 'We\'re preparing your order right now!',
    color:   'text-blue-600',
    bg:      'bg-blue-100',
    ring:    'ring-blue-400',
  },
  {
    key:     'READY',
    label:   'Ready',
    icon:    PackageCheck,
    message: 'Your order is ready! Please visit the counter to pay and collect.',
    color:   'text-green-600',
    bg:      'bg-green-100',
    ring:    'ring-green-400',
  },
  {
    key:     'COMPLETED',
    label:   'Completed',
    icon:    CheckCircle,
    message: 'Order complete. Thank you for your purchase!',
    color:   'text-gray-600',
    bg:      'bg-gray-100',
    ring:    'ring-gray-400',
  },
];

function stepIndex(status) {
  return STEPS.findIndex((s) => s.key === status);
}

// ── Progress Bar ──────────────────────────────────────────────
function ProgressBar({ status }) {
  const current = stepIndex(status);

  return (
    <div className="w-full px-2">
      <div className="flex items-center justify-between relative">
        {/* Connecting line behind */}
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-200 z-0" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-primary-500 z-0 transition-all duration-700"
          style={{ width: current <= 0 ? '0%' : `${(current / (STEPS.length - 1)) * 100}%` }}
        />

        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const done    = idx < current;
          const active  = idx === current;
          const pending = idx > current;

          return (
            <div key={step.key} className="flex flex-col items-center gap-1.5 z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ring-2 transition-all duration-300
                  ${done    ? 'bg-primary-600 ring-primary-600 text-white'   : ''}
                  ${active  ? `${step.bg} ${step.ring} ${step.color} animate-pulse` : ''}
                  ${pending ? 'bg-white ring-gray-200 text-gray-300'         : ''}`}
              >
                {done
                  ? <CheckCircle size={18} />
                  : <Icon size={18} />
                }
              </div>
              <span className={`text-[10px] font-semibold text-center leading-tight
                ${done || active ? 'text-gray-700' : 'text-gray-300'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main TrackOrderPage ───────────────────────────────────────
export default function TrackOrderPage() {
  const [searchParams] = useSearchParams();
  const shopId = searchParams.get('shop_id');
  const token  = searchParams.get('token');

  const [order,        setOrder]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [refreshing,   setRefreshing]   = useState(false);
  const [showCancel,   setShowCancel]   = useState(false);
  const [cancelPhone,  setCancelPhone]  = useState('');
  const [cancelling,   setCancelling]   = useState(false);
  const pollRef = useRef(null);

  async function fetchOrder(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await preOrdersApi.trackOrder(shopId, token);
      setOrder(res.data.order);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Order not found. Check your token and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!shopId || !token) {
      setError('Invalid link - missing shop ID or token.');
      setLoading(false);
      return;
    }
    fetchOrder();
    // Poll every 10s unless completed/cancelled
    pollRef.current = setInterval(() => {
      if (order && ['COMPLETED', 'CANCELLED'].includes(order.status)) {
        clearInterval(pollRef.current);
        return;
      }
      fetchOrder(true);
    }, 10000);
    return () => clearInterval(pollRef.current);
  }, [shopId, token]); // eslint-disable-line

  // Stop polling when done
  useEffect(() => {
    if (order && ['COMPLETED', 'CANCELLED'].includes(order.status)) {
      clearInterval(pollRef.current);
    }
  }, [order?.status]); // eslint-disable-line

  const items     = order ? (Array.isArray(order.items) ? order.items : []) : [];
  const stepInfo  = order ? STEPS.find((s) => s.key === order.status) : null;
  const isCancelled = order?.status === 'CANCELLED';

  function elapsed(dateStr) {
    const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  }

  async function handleCancelOrder() {
    if (!cancelPhone.trim()) { toast.error('Enter your phone number to confirm'); return; }
    setCancelling(true);
    try {
      await preOrdersApi.cancelOrder({ shop_id: shopId, order_id: order.id, phone: cancelPhone.trim() });
      toast.success('Order cancelled successfully.');
      setShowCancel(false);
      fetchOrder(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not cancel order. Try again.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        {shopId && (
          <Link
            to={`/order?shop_id=${shopId}`}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft size={18} />
          </Link>
        )}
        <div className="flex-1">
          <h1 className="font-bold text-gray-800 text-base leading-tight">
            {order?.shop_name || 'Track Order'}
          </h1>
          <p className="text-xs text-gray-400">Order Tracking</p>
        </div>
        <button
          onClick={() => fetchOrder(true)}
          disabled={refreshing}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-white rounded-2xl border border-red-100 p-6 text-center">
            <XCircle size={40} className="text-red-400 mx-auto mb-3" />
            <p className="font-semibold text-gray-700 mb-1">Order Not Found</p>
            <p className="text-sm text-gray-400 mb-4">{error}</p>
            {shopId && (
              <Link
                to={`/order?shop_id=${shopId}`}
                className="inline-block px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold"
              >
                Place New Order
              </Link>
            )}
          </div>
        )}

        {/* Order card */}
        {!loading && order && (
          <>
            {/* Token + status */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className={`px-4 py-4 ${isCancelled ? 'bg-red-50' : stepInfo?.bg || 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Token</p>
                  <p className="text-xs text-gray-400">{elapsed(order.created_at)}</p>
                </div>
                <p className={`text-4xl font-black tracking-wider ${isCancelled ? 'text-red-500' : stepInfo?.color || 'text-gray-700'}`}>
                  {order.token_number}
                </p>
                {order.customer_name && (
                  <p className="text-sm text-gray-500 mt-0.5">{order.customer_name}</p>
                )}
              </div>

              {/* Progress bar (not shown for cancelled) */}
              {!isCancelled && (
                <div className="px-4 py-5">
                  <ProgressBar status={order.status} />
                </div>
              )}

              {/* Cancelled state */}
              {isCancelled && (
                <div className="px-4 py-4 flex items-center gap-2 text-red-600">
                  <XCircle size={18} />
                  <p className="text-sm font-medium">This order was cancelled.</p>
                </div>
              )}
            </div>

            {/* Status message */}
            {stepInfo && !isCancelled && (
              <div className={`rounded-xl px-4 py-3 border ${stepInfo.bg} border-opacity-50`}>
                <p className={`text-sm font-medium ${stepInfo.color}`}>{stepInfo.message}</p>
              </div>
            )}

            {/* Cancel button - only while PENDING */}
            {order.status === 'PENDING' && (
              <button
                onClick={() => { setShowCancel(true); setCancelPhone(''); }}
                className="w-full text-center py-2.5 rounded-xl border border-red-200 bg-red-50
                           text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                Cancel This Order
              </button>
            )}

            {/* Payment status */}
            {order.payment_status === 'paid' ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2.5">
                <CheckCheck size={18} className="text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-700">Payment Confirmed</p>
                  <p className="text-xs text-green-600 mt-0.5">Your payment has been received by the cashier.</p>
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-2.5">
                <CreditCard size={18} className="text-orange-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-orange-700">Payment Pending</p>
                  <p className="text-xs text-orange-600 mt-0.5">Please pay at the counter when collecting your order.</p>
                </div>
              </div>
            )}

            {/* Order summary */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">Order Summary</p>
              </div>
              <ul className="divide-y divide-gray-50 px-4">
                {items.map((item, idx) => (
                  <li key={idx} className="flex justify-between py-2.5 text-sm text-gray-700">
                    <span>{item.name} <span className="text-gray-400">× {item.quantity}</span></span>
                    <span className="font-medium">Rs {(Number(item.price) * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-3 border-t border-gray-100 flex justify-between font-bold text-gray-800">
                <span>Total</span>
                <span>Rs {Number(order.total_amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Place new order */}
            {shopId && (
              <Link
                to={`/order?shop_id=${shopId}`}
                className="block w-full text-center py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Place New Order
              </Link>
            )}
          </>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Cancel Order?</p>
                  <p className="text-xs text-gray-500">Token: {order?.token_number}</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4 text-xs text-amber-700">
                <strong>Cancellation Policy:</strong> Repeated cancellations may result in a temporary pre-order block for your account.
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm your phone number
              </label>
              <input
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
                placeholder="e.g. 0712345678"
                value={cancelPhone}
                onChange={(e) => setCancelPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCancelOrder()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowCancel(false)}
              >
                Keep Order
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                onClick={handleCancelOrder}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
