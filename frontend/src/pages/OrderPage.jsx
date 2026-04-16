import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, Search, CheckCircle, X, RotateCcw, Phone, MapPin, AlertTriangle, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { preOrdersApi } from '../api/client';

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 1)  return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

// ── Product Card ──────────────────────────────────────────────
function ProductCard({ product, qty, onAdd, onRemove }) {
  const outOfStock = product.has_inventory && product.stock_quantity <= 0;

  return (
    <div className={`bg-white rounded-xl border ${outOfStock ? 'opacity-50' : 'border-gray-200'} p-3 flex flex-col gap-2`}>
      <div className="flex-1">
        {product.category && (
          <span className="text-xs text-gray-400 uppercase tracking-wide">{product.category}</span>
        )}
        <p className="font-semibold text-gray-800 leading-tight mt-0.5">{product.name}</p>
        <p className="text-primary-600 font-bold text-base mt-1">Rs {Number(product.price).toFixed(2)}</p>
        {outOfStock && <p className="text-xs text-red-500 mt-0.5">Out of stock</p>}
      </div>
      {outOfStock ? (
        <button disabled className="w-full py-1.5 rounded-lg bg-gray-100 text-gray-400 text-sm">
          Unavailable
        </button>
      ) : qty > 0 ? (
        <div className="flex items-center justify-between bg-primary-50 rounded-lg px-2 py-1">
          <button onClick={onRemove} className="p-1 rounded-full hover:bg-primary-100 text-primary-700">
            <Minus size={14} />
          </button>
          <span className="font-bold text-primary-700 w-6 text-center">{qty}</span>
          <button onClick={onAdd} className="p-1 rounded-full hover:bg-primary-100 text-primary-700">
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={onAdd}
          className="w-full py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium flex items-center justify-center gap-1"
        >
          <Plus size={14} /> Add
        </button>
      )}
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────
function SuccessScreen({ token, shopId, shopName, onPlaceAnother }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-6 z-50 overflow-y-auto">
      <div className="w-full max-w-sm mx-auto flex flex-col items-center">
        <CheckCircle size={52} className="text-green-500 mb-3" />
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Order Placed!</h1>
        <p className="text-gray-500 mb-5 text-center text-sm">
          Your pre-order at <strong>{shopName}</strong> is confirmed.
        </p>

        {/* Token + QR card */}
        <div className="w-full bg-primary-50 border-2 border-primary-200 rounded-2xl p-5 mb-4 text-center">
          <p className="text-xs text-primary-500 uppercase tracking-widest mb-1">Your Token</p>
          <p className="text-5xl font-black text-primary-700 tracking-wider mb-4">{token}</p>

          <div className="flex justify-center mb-3">
            <div className="bg-white p-2.5 rounded-xl border border-primary-100 inline-block">
              <QRCodeSVG value={token} size={130} level="M" />
            </div>
          </div>

          <p className="text-xs text-primary-500">
            Show this QR or token at the counter
          </p>
        </div>

        {/* Instruction */}
        <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex gap-2.5">
          <MapPin size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Visit the shop, show your token to pay and collect your items.
          </p>
        </div>

        {/* Action buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={() => navigate(`/track?shop_id=${shopId}&token=${token}`)}
            className="w-full py-3 rounded-xl border-2 border-primary-600 text-primary-700 font-semibold text-sm hover:bg-primary-50 transition-colors"
          >
            Track Order Status
          </button>
          <button
            onClick={onPlaceAnother}
            className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors"
          >
            Place Another Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status badge helper ───────────────────────────────────────
const STATUS_BADGE = {
  PENDING:   { label: 'Pending',   cls: 'bg-yellow-100 text-yellow-700' },
  PREPARING: { label: 'Preparing', cls: 'bg-blue-100 text-blue-700'    },
  READY:     { label: 'Ready!',    cls: 'bg-green-100 text-green-700'   },
  COMPLETED: { label: 'Completed', cls: 'bg-gray-100 text-gray-500'    },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-500'      },
};
const PAYMENT_BADGE = {
  paid:    { label: 'Paid',    cls: 'bg-green-100 text-green-700' },
  pending: { label: 'Unpaid',  cls: 'bg-orange-100 text-orange-600' },
};
const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY'];

// ── Main OrderPage ────────────────────────────────────────────
export default function OrderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const shopId = searchParams.get('shop_id');

  const [shop, setShop]                         = useState(null);
  const [products, setProducts]                 = useState([]);
  const [search, setSearch]                     = useState('');
  const [cart, setCart]                         = useState({});   // { productId: qty }
  const [phone, setPhone]                       = useState('');
  const [name, setName]                         = useState('');
  const [loading, setLoading]                   = useState(true);
  const [submitting, setSubmitting]             = useState(false);
  const [token, setToken]                       = useState(null);
  const [history, setHistory]                   = useState([]);
  const [showCart, setShowCart]                 = useState(false);
  const [error, setError]                       = useState('');
  const [cancellationStatus, setCancellationStatus] = useState(null); // { total_cancellations, cooldown_active, cooldown_until }

  // Saved order (localStorage — persists across page closes)
  const [savedOrder,   setSavedOrder]   = useState(null); // { token, shopId, createdAt }
  const [showSavedQR,  setShowSavedQR]  = useState(false);

  const LS_KEY = shopId ? `pos_last_order_${shopId}` : null;

  // Load shop + products
  useEffect(() => {
    if (!shopId) { setError('Invalid link — no shop ID found.'); setLoading(false); return; }
    Promise.all([
      preOrdersApi.getShop(shopId),
      preOrdersApi.getProducts(shopId),
    ])
      .then(([shopRes, prodRes]) => {
        setShop(shopRes.data.shop);
        setProducts(prodRes.data.products || []);
      })
      .catch((err) => setError(err.response?.data?.error || 'Could not load shop. Please check your link.'))
      .finally(() => setLoading(false));
  }, [shopId]);

  // Check localStorage for a previously placed order on this device
  useEffect(() => {
    if (!LS_KEY) return;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const hoursAgo = (Date.now() - new Date(parsed.createdAt)) / 3_600_000;
      if (hoursAgo >= 24) { localStorage.removeItem(LS_KEY); return; }
      // Verify the order is still active before showing the banner
      preOrdersApi.trackOrder(shopId, parsed.token)
        .then(({ data }) => {
          if (ACTIVE_STATUSES.includes(data.order.status)) {
            setSavedOrder({ ...parsed, status: data.order.status });
          } else {
            localStorage.removeItem(LS_KEY); // completed or cancelled — don't show
          }
        })
        .catch(() => setSavedOrder(parsed)); // network error — show it anyway
    } catch {
      localStorage.removeItem(LS_KEY);
    }
  }, [LS_KEY]); // eslint-disable-line

  // Fetch order history + cancellation status when phone is provided
  const fetchHistory = useCallback(async () => {
    if (!phone || phone.length < 7 || !shopId) return;
    try {
      const [histRes, cancelRes] = await Promise.all([
        preOrdersApi.getHistory(shopId, phone),
        preOrdersApi.getCancellationStatus(shopId, phone).catch(() => ({ data: null })),
      ]);
      setHistory(histRes.data.orders || []);
      if (cancelRes.data) setCancellationStatus(cancelRes.data);
    } catch { /* silent */ }
  }, [phone, shopId]);

  // ── Cart helpers ──────────────────────────────────────────
  const addItem = (productId) =>
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));

  const removeItem = (productId) =>
    setCart((prev) => {
      const next = { ...prev };
      if ((next[productId] || 0) <= 1) delete next[productId];
      else next[productId] -= 1;
      return next;
    });

  const cartItems = products.filter((p) => cart[p.id] > 0);
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = cartItems.reduce((sum, p) => sum + Number(p.price) * cart[p.id], 0);

  const applyReorder = (order) => {
    const newCart = {};
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item) => {
      const match = products.find((p) => p.id === item.product_id || p.name === item.name);
      if (match && !(match.has_inventory && match.stock_quantity <= 0)) {
        newCart[match.id] = item.quantity || 1;
      }
    });
    setCart(newCart);
    setShowCart(true);
    toast.success('Previous order loaded into cart!');
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!phone.trim()) { toast.error('Please enter your phone number'); return; }
    if (cartCount === 0) { toast.error('Your cart is empty'); return; }

    // Block if on cooldown
    if (cancellationStatus?.cooldown_active) {
      const until = new Date(cancellationStatus.cooldown_until);
      const hoursLeft = Math.ceil((until - Date.now()) / 3600000);
      toast.error(`Pre-order disabled due to repeated cancellations. Try again after ${hoursLeft} hour(s).`);
      return;
    }

    const items = cartItems.map((p) => ({
      product_id: p.id,
      name:       p.name,
      price:      Number(p.price),
      quantity:   cart[p.id],
    }));

    setSubmitting(true);
    try {
      const res = await preOrdersApi.create({
        shop_id:        Number(shopId),
        customer_phone: phone.trim(),
        customer_name:  name.trim() || undefined,
        items,
        total_amount:   cartTotal,
      });
      const newToken = res.data.token;
      setToken(newToken);
      setCart({});
      setHistory([]);
      // Persist so customer can find this token if they close the tab
      if (LS_KEY) {
        localStorage.setItem(LS_KEY, JSON.stringify({
          token: newToken,
          shopId,
          createdAt: new Date().toISOString(),
        }));
        setSavedOrder(null); // success screen is showing, banner not needed yet
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Filtered products ─────────────────────────────────────
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Error / Loading states ────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <X size={48} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }
  if (token) {
    return (
      <SuccessScreen
        token={token}
        shopId={shopId}
        shopName={shop?.name || 'the shop'}
        onPlaceAnother={() => {
          setToken(null);
          setPhone('');
          setName('');
          if (LS_KEY) localStorage.removeItem(LS_KEY);
          setSavedOrder(null);
          setShowSavedQR(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="font-bold text-gray-800 text-lg leading-tight">{shop?.name || 'Shop'}</h1>
          <p className="text-xs text-gray-400">Pre-Order Menu</p>
        </div>
        <button
          onClick={() => setShowCart(true)}
          className="relative p-2 rounded-full bg-primary-50 text-primary-600"
        >
          <ShoppingCart size={20} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Active Order Banner (shown when customer has an existing order on this device) */}
      {savedOrder && (
        <div className="mx-4 mt-3 bg-primary-50 border border-primary-200 rounded-2xl overflow-hidden">
          <div className="flex items-start justify-between px-4 pt-3 pb-2">
            <div>
              <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide">Your Active Order</p>
              <p className="text-4xl font-black text-primary-700 tracking-wider leading-none mt-0.5">
                {savedOrder.token}
              </p>
              {savedOrder.status && (
                <span className={`inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full
                  ${STATUS_BADGE[savedOrder.status]?.cls || ''}`}>
                  {STATUS_BADGE[savedOrder.status]?.label || savedOrder.status}
                </span>
              )}
            </div>
            <button
              onClick={() => { setSavedOrder(null); setShowSavedQR(false); if (LS_KEY) localStorage.removeItem(LS_KEY); }}
              className="text-primary-300 hover:text-primary-500 p-1 -mr-1 -mt-0.5"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>

          {/* QR code — collapsible */}
          {showSavedQR && (
            <div className="flex justify-center pb-3">
              <div className="bg-white p-2.5 rounded-xl border border-primary-100 inline-block">
                <QRCodeSVG value={savedOrder.token} size={140} level="M" />
              </div>
            </div>
          )}

          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => navigate(`/track?shop_id=${shopId}&token=${savedOrder.token}`)}
              className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
            >
              Track Status
            </button>
            <button
              onClick={() => setShowSavedQR((v) => !v)}
              className="flex-1 py-2 rounded-xl border border-primary-300 text-primary-700 text-sm font-semibold hover:bg-primary-100 transition-colors"
            >
              {showSavedQR ? 'Hide QR' : 'Show QR'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {filtered.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            qty={cart[product.id] || 0}
            onAdd={() => addItem(product.id)}
            onRemove={() => removeItem(product.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-400">No products found</div>
        )}
      </div>

      {/* Cart Drawer Overlay */}
      {showCart && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Your Order</h2>
              <button onClick={() => setShowCart(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3">
              {/* Cart Items */}
              {cartItems.length === 0 ? (
                <p className="text-center text-gray-400 py-6">Your cart is empty</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {cartItems.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">Rs {Number(p.price).toFixed(2)} × {cart[p.id]}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button onClick={() => removeItem(p.id)} className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600">
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{cart[p.id]}</span>
                        <button onClick={() => addItem(p.id)} className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600">
                          <Plus size={12} />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 ml-3 w-16 text-right">
                        Rs {(Number(p.price) * cart[p.id]).toFixed(2)}
                      </p>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
                    <span className="font-bold text-gray-800">Total</span>
                    <span className="font-bold text-primary-700">Rs {cartTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Customer Details */}
              <div className="space-y-3 mt-4">
                <h3 className="font-semibold text-gray-700 text-sm">Your Details</h3>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="Phone number *"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setCancellationStatus(null); }}
                    onBlur={fetchHistory}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />

                {/* Cancellation warning / cooldown block */}
                {cancellationStatus?.cooldown_active && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <Clock size={15} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Pre-order temporarily disabled</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        Due to repeated cancellations. Try again after{' '}
                        {Math.ceil((new Date(cancellationStatus.cooldown_until) - Date.now()) / 3600000)} hour(s).
                      </p>
                    </div>
                  </div>
                )}
                {!cancellationStatus?.cooldown_active && cancellationStatus?.total_cancellations >= 2 && (
                  <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                    <AlertTriangle size={15} className="text-orange-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-700">
                      You have cancelled multiple orders. If this continues, pre-order access will be limited.
                    </p>
                  </div>
                )}
                {!cancellationStatus?.cooldown_active && cancellationStatus?.total_cancellations === 1 && (
                  <div className="flex items-start gap-2.5 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                    <AlertTriangle size={15} className="text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-700">
                      You have a previous cancellation on record. Please ensure you collect your order after placing.
                    </p>
                  </div>
                )}
              </div>

              {/* Previous Orders — Reorder */}
              {history.length > 0 && (
                <div className="mt-5">
                  <h3 className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-1">
                    <RotateCcw size={14} /> Previous Orders
                  </h3>
                  <div className="space-y-2">
                    {history.map((order) => {
                      const items = Array.isArray(order.items) ? order.items : [];
                      const badge = STATUS_BADGE[order.status];
                      const isActive = ACTIVE_STATUSES.includes(order.status);
                      return (
                        <div key={order.id} className="bg-gray-50 rounded-xl p-3 flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-semibold text-gray-700 truncate">
                                Token <strong>{order.token_number}</strong>
                              </p>
                              {badge && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              )}
                              {(() => {
                                const pb = PAYMENT_BADGE[order.payment_status || 'pending'];
                                return pb ? (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pb.cls}`}>
                                    {pb.label}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {items.map((i) => i.name).join(', ')}
                            </p>
                            <p className="text-xs text-gray-400">
                              Rs {Number(order.total_amount).toFixed(2)} · {timeAgo(order.created_at)}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            {isActive && (
                              <button
                                onClick={() => navigate(`/track?shop_id=${shopId}&token=${order.token_number}`)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-medium whitespace-nowrap hover:bg-blue-200"
                              >
                                Track →
                              </button>
                            )}
                            <button
                              onClick={() => applyReorder(order)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-primary-100 text-primary-700 font-medium whitespace-nowrap hover:bg-primary-200"
                            >
                              Reorder
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Place Order Button */}
            <div className="px-4 py-4 border-t border-gray-100 bg-white">
              <button
                onClick={handleSubmit}
                disabled={submitting || cartCount === 0 || cancellationStatus?.cooldown_active}
                className="w-full py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-base transition-colors"
              >
                {submitting
                  ? 'Placing Order...'
                  : cancellationStatus?.cooldown_active
                    ? 'Pre-order Disabled'
                    : `Place Order · Rs ${cartTotal.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky bottom bar (when cart has items and drawer is closed) */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-30">
          <button
            onClick={() => setShowCart(true)}
            className="w-full py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-base flex items-center justify-between px-5"
          >
            <span className="bg-primary-700 rounded-lg px-2 py-0.5 text-sm">{cartCount}</span>
            <span>View Order</span>
            <span>Rs {cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
