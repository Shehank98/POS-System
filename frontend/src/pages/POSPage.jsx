import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Barcode, Search, X, Plus, Minus,
  ShoppingCart, Percent, CreditCard, Smartphone,
  Wifi, RefreshCw, Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore   from '../store/cartStore';
import useAuthStore   from '../store/authStore';
import { productsApi } from '../api/client';
import PaymentModal      from '../components/PaymentModal';
import usePosScanner     from '../hooks/usePosScanner';
import PhoneScannerModal from '../components/PhoneScannerModal';
import PosCameraScanner  from '../components/PosCameraScanner';

const fmt = (n) => Number(n || 0).toFixed(2);

// ── Colour accent strip (by first letter, Tailwind classes kept literal for purge) ──
const ACCENTS = [
  'bg-red-400',    'bg-orange-400', 'bg-amber-400',  'bg-lime-500',
  'bg-green-500',  'bg-teal-400',   'bg-cyan-500',   'bg-blue-400',
  'bg-violet-500', 'bg-purple-400', 'bg-pink-400',   'bg-rose-400',
];
const accent = (name) => ACCENTS[(name.charCodeAt(0) || 0) % ACCENTS.length];

// ── Compact product card (no image — slim left accent strip) ───
function ProductCard({ product, onSelect, disabled }) {
  const outOfStock = product.has_inventory && product.stock_quantity <= 0;
  const lowStock   = product.has_inventory && product.stock_quantity > 0
                     && product.stock_quantity <= 5;

  return (
    <button
      onClick={() => onSelect(product)}
      disabled={disabled || outOfStock}
      className={`relative flex rounded-xl border text-left transition-all duration-100
                  active:scale-[0.97] select-none overflow-hidden min-h-[64px]
                  ${outOfStock
                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md cursor-pointer'}`}
    >
      {/* Colour accent strip — 4px left edge */}
      <div className={`w-1 shrink-0 self-stretch ${accent(product.name)}`} />

      {/* Content */}
      <div className="flex flex-col justify-between flex-1 px-2.5 py-2.5 gap-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-900 leading-snug line-clamp-2">
          {product.name}
        </p>
        <div className="flex items-center gap-1">
          {product.category && (
            <span className="text-[10px] text-gray-400 truncate flex-1">
              {product.category}
            </span>
          )}
          <span className="text-[13px] font-bold text-primary-700 shrink-0 ml-auto">
            {fmt(product.price)}
          </span>
        </div>
      </div>

      {/* Stock badges — top-right corner */}
      {outOfStock && (
        <span className="absolute top-1.5 right-1.5 text-[9px] bg-red-100 text-red-600
                         px-1.5 py-0.5 rounded font-semibold leading-tight">Out</span>
      )}
      {lowStock && (
        <span className="absolute top-1.5 right-1.5 text-[9px] bg-orange-100 text-orange-600
                         px-1.5 py-0.5 rounded font-semibold leading-tight">
          {product.stock_quantity}
        </span>
      )}
    </button>
  );
}

// ── Cart item row ─────────────────────────────────────────────
function CartRow({ item, onQty, onDiscount, onRemove }) {
  const [editDisc,  setEditDisc]  = useState(false);
  const [discInput, setDiscInput] = useState(String(item.discount_pct));

  function commitDiscount() {
    onDiscount(item.cartId, discInput);
    setEditDisc(false);
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 leading-snug flex-1">{item.name}</p>
        <button
          className="text-gray-300 hover:text-red-500 shrink-0 mt-0.5"
          onClick={() => onRemove(item.cartId)}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200
                       hover:bg-gray-100 text-gray-600"
            onClick={() => onQty(item.cartId, item.quantity - 1)}
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            className="w-12 h-6 text-center text-sm border border-gray-200 rounded"
            type="number" min="1"
            value={item.quantity}
            onChange={(e) => onQty(item.cartId, parseInt(e.target.value, 10) || 1)}
          />
          <button
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200
                       hover:bg-gray-100 text-gray-600"
            onClick={() => onQty(item.cartId, item.quantity + 1)}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <span className="text-xs text-gray-400">× {fmt(item.unit_price)}</span>

        <button
          className={`flex items-center gap-0.5 text-xs rounded px-1.5 py-0.5 transition-colors
            ${item.discount_pct > 0
              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          onClick={() => { setEditDisc(true); setDiscInput(String(item.discount_pct)); }}
        >
          <Percent className="w-3 h-3" />
          {item.discount_pct > 0 ? `${item.discount_pct}%` : 'Disc'}
        </button>

        <span className="text-sm font-semibold text-gray-900 min-w-[50px] text-right">
          {fmt(item.subtotal)}
        </span>
      </div>

      {editDisc && (
        <div className="flex items-center gap-2 bg-orange-50 rounded px-2 py-1.5">
          <Percent className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <input
            className="input h-6 text-xs py-0 px-2 w-20"
            type="number" min="0" max="100" step="1"
            autoFocus
            value={discInput}
            onChange={(e) => setDiscInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitDiscount()}
          />
          <span className="text-xs text-orange-600">%</span>
          <button className="btn-primary text-xs py-0.5 px-2 h-6" onClick={commitDiscount}>OK</button>
          <button className="btn-secondary text-xs py-0.5 px-2 h-6"
                  onClick={() => setEditDisc(false)}>×</button>
        </div>
      )}
    </li>
  );
}

// ── Cart panel (desktop sidebar + mobile drawer) ───────────────
function CartPanel({ onPayClick, onClose }) {
  const {
    items, orderDiscount,
    setQty, setItemDiscount, removeItem, setOrderDiscount, clearCart,
  } = useCartStore();
  const totals = useCartStore((s) => s.totals);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <span className="font-semibold text-gray-800">
          Cart
          {items.length > 0 && (
            <span className="ml-2 text-xs bg-primary-100 text-primary-700 rounded-full px-2 py-0.5">
              {items.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button className="text-xs text-red-400 hover:text-red-600" onClick={clearCart}>
              Clear
            </button>
          )}
          {onClose && (
            <button className="p-1 text-gray-400 hover:text-gray-600" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <ul className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <li className="flex flex-col items-center justify-center h-full text-gray-300 gap-3 py-12">
            <ShoppingCart className="w-12 h-12" />
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs text-gray-300">Tap a product to add it</p>
          </li>
        )}
        {items.map((item) => (
          <CartRow
            key={item.cartId}
            item={item}
            onQty={setQty}
            onDiscount={setItemDiscount}
            onRemove={removeItem}
          />
        ))}
      </ul>

      {/* Totals */}
      <div className="border-t border-gray-200 px-4 py-3 space-y-1.5 bg-gray-50 shrink-0">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span><span>{fmt(totals.itemsSubtotal)}</span>
        </div>
        {totals.itemsDiscount > 0 && (
          <div className="flex justify-between text-sm text-orange-600">
            <span>Item discounts</span><span>-{fmt(totals.itemsDiscount)}</span>
          </div>
        )}
        {totals.taxAmount > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax</span><span>+{fmt(totals.taxAmount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm text-orange-600">
          <span>Order discount</span>
          <input
            className="w-20 h-6 text-xs text-right border border-orange-200 rounded px-1"
            type="number" min="0" step="0.01" placeholder="0.00"
            value={orderDiscount || ''}
            onChange={(e) => setOrderDiscount(e.target.value)}
          />
        </div>
        <div className="flex justify-between font-bold text-gray-900 text-base pt-1
                        border-t border-gray-200">
          <span>Total</span>
          <span className="text-primary-700">{fmt(totals.grandTotal)}</span>
        </div>
      </div>

      {/* Charge button */}
      <div className="px-4 pb-4 pt-2 bg-gray-50 shrink-0">
        <button
          className="btn-primary w-full justify-center py-3 text-base"
          disabled={items.length === 0}
          onClick={onPayClick}
        >
          <CreditCard className="w-5 h-5" /> Charge {fmt(totals.grandTotal)}
        </button>
      </div>
    </div>
  );
}

// ── Main POS Page ─────────────────────────────────────────────
export default function POSPage() {
  const user           = useAuthStore((s) => s.user);
  const barcodeEnabled = user?.barcode_enabled ?? false;
  const readOnly       = user?.read_only ?? false;

  const [scannerMode] = useState(() => localStorage.getItem('scannerMode') || 'both');
  const showUsb   = barcodeEnabled && (scannerMode === 'usb'   || scannerMode === 'both');
  const showPhone = barcodeEnabled && (scannerMode === 'phone' || scannerMode === 'both');

  const { items, addItem, clearCart } = useCartStore();
  const totals = useCartStore((s) => s.totals);

  // Product browser state
  const [allProducts,    setAllProducts]    = useState([]);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loadingProds,   setLoadingProds]   = useState(false);

  // UI state
  const [barcodeInput,   setBarcodeInput]   = useState('');
  const [scanning,       setScanning]       = useState(false);
  const [showPayment,    setShowPayment]     = useState(false);
  const [showPhoneModal, setShowPhoneModal]  = useState(false);
  const [showMobileCart, setShowMobileCart]  = useState(false);
  const [showCamera,     setShowCamera]      = useState(false);

  const barcodeRef = useRef();

  // ── Derived: categories + filtered products ──────────────────
  const categories = useMemo(() => {
    const cats = [...new Set(allProducts.map((p) => p.category).filter(Boolean))].sort();
    return ['All', ...cats];
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    let prods = allProducts;
    if (activeCategory !== 'All') prods = prods.filter((p) => p.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      prods = prods.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }
    return prods;
  }, [allProducts, searchQuery, activeCategory]);

  // ── Load products ────────────────────────────────────────────
  function loadProducts() {
    setLoadingProds(true);
    productsApi.list({ limit: 500 })
      .then(({ data }) => setAllProducts(data.products))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoadingProds(false));
  }

  useEffect(() => {
    loadProducts();
    barcodeRef.current?.focus();
  }, []); // eslint-disable-line

  // ── Phone scanner WebSocket ──────────────────────────────────
  const handlePhoneBarcode = useCallback(async (code) => {
    if (readOnly) return;
    try {
      const { data } = await productsApi.byBarcode(code);
      addItem(data);
      toast.success(`Added: ${data.name}`);
    } catch {
      toast.error(`Barcode "${code}" not found`);
    }
  }, [addItem, readOnly]);

  const phoneScanner = usePosScanner({ onBarcode: handlePhoneBarcode });

  // ── USB barcode submit ────────────────────────────────────────
  async function handleBarcodeSubmit(e) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setScanning(true);
    try {
      const { data } = await productsApi.byBarcode(code);
      addItem(data);
      setBarcodeInput('');
    } catch {
      toast.error(`Barcode "${code}" not found`);
    } finally {
      setScanning(false);
      barcodeRef.current?.focus();
    }
  }

  function handleProductSelect(product) {
    if (readOnly) return;
    addItem(product);
  }

  const totalItemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col md:flex-row -mx-4 -my-6
                    md:h-[calc(100vh-5rem)] md:overflow-hidden">

      {/* ── LEFT: product browser ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">

        {/* Top toolbar */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-200 shrink-0">
          {/* USB barcode field */}
          {showUsb ? (
            <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-1.5 flex-1 min-w-0">
              <Barcode className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                ref={barcodeRef}
                className="input py-1.5 text-sm font-mono h-8 flex-1 min-w-0"
                placeholder="Scan barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                disabled={readOnly}
                autoComplete="off"
              />
              <button type="submit" className="btn-secondary h-8 px-2.5 text-xs shrink-0"
                      disabled={readOnly || scanning}>
                Add
              </button>
            </form>
          ) : (
            <span className="font-bold text-gray-900 text-sm shrink-0">POS Terminal</span>
          )}

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* Phone scanner button */}
            {showPhone && !readOnly && (
              <button
                onClick={() => setShowPhoneModal(true)}
                title="Phone scanner"
                className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border
                            font-medium transition-colors
                  ${phoneScanner.state === 'phone_connected'
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : phoneScanner.state === 'waiting'
                    ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {phoneScanner.state === 'phone_connected'
                  ? <Wifi className="w-3.5 h-3.5" />
                  : <Smartphone className="w-3.5 h-3.5" />
                }
                <span className="hidden sm:inline">
                  {phoneScanner.state === 'phone_connected' ? 'Phone' : 'Scanner'}
                </span>
              </button>
            )}
            {/* Camera scanner — direct device camera, ideal for mobile */}
            {barcodeEnabled && !readOnly && (
              <button
                onClick={() => setShowCamera(true)}
                title="Use device camera to scan barcode"
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border
                           bg-white border-gray-200 text-gray-600 hover:bg-gray-50
                           font-medium transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Camera</span>
              </button>
            )}
            {/* Reload */}
            <button
              onClick={loadProducts}
              disabled={loadingProds}
              title="Reload products"
              className="p-1.5 rounded-lg border border-gray-200 text-gray-400
                         hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingProds ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Read-only banner */}
        {readOnly && (
          <div className="mx-3 mt-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800
                          rounded-lg px-3 py-2 shrink-0">
            Read-only mode — sales disabled. Renew subscription.
          </div>
        )}

        {/* Search */}
        <div className="px-3 pt-2 pb-1.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9 pr-8 h-9 text-sm bg-white"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setActiveCategory('All'); }}
            />
            {searchQuery && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        {categories.length > 1 && (
          <div className="flex gap-1.5 px-3 pb-1.5 overflow-x-auto shrink-0"
               style={{ scrollbarWidth: 'none' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
                className={`whitespace-nowrap text-xs px-3 py-1 rounded-full border
                            font-medium transition-colors shrink-0
                  ${activeCategory === cat
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Product grid */}
        {/* pb accounts for: bottom nav (56px) + cart button (~52px) + gap = ~120px */}
        <div className="flex-1 overflow-y-auto px-3 pb-32 md:pb-4">
          {loadingProds ? (
            /* Skeleton — matches compact card shape */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-1">
              {[...Array(14)].map((_, i) => (
                <div key={i} className="flex rounded-xl border border-gray-200 overflow-hidden
                                        animate-pulse min-h-[64px]">
                  <div className="w-1 bg-gray-200 shrink-0" />
                  <div className="flex-1 px-2.5 py-2.5 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-4/5" />
                    <div className="h-3 bg-gray-200 rounded w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-300 gap-2">
              <ShoppingCart className="w-12 h-12" />
              <p className="text-sm">
                {searchQuery ? 'No products match your search' : 'No products yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-1">
              {filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onSelect={handleProductSelect}
                  disabled={readOnly}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: cart (desktop) ────────────────────────────── */}
      <div className="hidden md:flex w-80 xl:w-96 flex-col bg-white border-l border-gray-200
                      overflow-hidden shrink-0">
        <CartPanel onPayClick={() => setShowPayment(true)} />
      </div>

      {/* ── MOBILE: floating cart button (sits between bottom nav h-14=56px and content) ── */}
      <div className="md:hidden fixed bottom-[3.75rem] left-0 right-0 z-30 px-3 pointer-events-none">
        <button
          className="w-full btn-primary py-3 justify-between text-sm shadow-xl rounded-xl
                     pointer-events-auto"
          onClick={() => setShowMobileCart(true)}
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            <span>
              {totalItemCount > 0
                ? `Cart (${totalItemCount} item${totalItemCount !== 1 ? 's' : ''})`
                : 'Cart is empty'}
            </span>
          </div>
          <span className="font-bold">{fmt(totals.grandTotal)}</span>
        </button>
      </div>

      {/* ── MOBILE: cart drawer ───────────────────────────────── */}
      {showMobileCart && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setShowMobileCart(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-white rounded-t-2xl
                       overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <CartPanel
                onPayClick={() => { setShowMobileCart(false); setShowPayment(true); }}
                onClose={() => setShowMobileCart(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Phone scanner modal */}
      {showPhoneModal && (
        <PhoneScannerModal
          state={phoneScanner.state}
          code={phoneScanner.code}
          onClose={() => setShowPhoneModal(false)}
          onConnect={phoneScanner.connect}
          onDisconnect={phoneScanner.disconnect}
        />
      )}

      {/* Direct device camera scanner — stays open for multi-scan */}
      {showCamera && (
        <PosCameraScanner
          onDone={(items) => {
            items.forEach(({ product, quantity }) => addItem(product, quantity));
            if (items.length > 0) {
              const total = items.reduce((s, i) => s + i.quantity, 0);
              toast.success(`Added ${total} item${total !== 1 ? 's' : ''} to cart`);
            }
            barcodeRef.current?.focus();
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal
          totals={totals}
          items={items}
          onClose={() => setShowPayment(false)}
          onComplete={() => {
            setShowPayment(false);
            clearCart();
            loadProducts();
            barcodeRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
