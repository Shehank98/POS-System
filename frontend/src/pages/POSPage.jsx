import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Barcode, Search, X, Plus, Minus, Trash2,
  ShoppingCart, Percent, CreditCard, Smartphone,
  ChevronUp, Wifi, WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore   from '../store/cartStore';
import useAuthStore   from '../store/authStore';
import { productsApi } from '../api/client';
import PaymentModal   from '../components/PaymentModal';
import usePosScanner  from '../hooks/usePosScanner';
import PhoneScannerModal from '../components/PhoneScannerModal';

const fmt = (n) => Number(n || 0).toFixed(2);

// ── Product search dropdown ───────────────────────────────────
function ProductSearch({ onSelect }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await productsApi.list({ search: query, limit: 10 });
        setResults(data.products);
        setOpen(true);
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [query]);

  function select(p) {
    onSelect(p);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9 pr-8"
          placeholder="Search product by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {(query || loading) && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
            onMouseDown={(e) => { e.preventDefault(); setQuery(''); setOpen(false); }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg
                        shadow-lg max-h-56 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button
                className="w-full flex items-center justify-between px-3 py-2
                           hover:bg-gray-50 text-left text-sm"
                onMouseDown={(e) => { e.preventDefault(); select(p); }}
              >
                <span>
                  <span className="font-medium text-gray-900">{p.name}</span>
                  {p.category && (
                    <span className="text-gray-400 text-xs ml-2">{p.category}</span>
                  )}
                </span>
                <span className="font-semibold text-primary-600 shrink-0 ml-3">
                  {fmt(p.price)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg
                        shadow-sm px-3 py-2 text-sm text-gray-400">
          No products found
        </div>
      )}
    </div>
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
            type="number"
            min="1"
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

        <span className="text-xs text-gray-400">x {fmt(item.unit_price)}</span>

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
                  onClick={() => setEditDisc(false)}>x</button>
        </div>
      )}
    </li>
  );
}

// ── Cart panel (used for desktop sidebar + mobile drawer) ─────
function CartPanel({ onPayClick, onClose }) {
  const {
    items, orderDiscount,
    setQty, setItemDiscount, removeItem, setOrderDiscount, clearCart,
  } = useCartStore();
  const totals = useCartStore((s) => s.totals);

  return (
    <div className="flex flex-col h-full">
      {/* Cart header */}
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
          {/* Close button (mobile drawer only) */}
          {onClose && (
            <button className="p-1 text-gray-400 hover:text-gray-600" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Items list */}
      <ul className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <li className="flex items-center justify-center h-full text-gray-300 text-sm py-8">
            Cart is empty
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

      {/* Pay button */}
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

  // Scanner mode from localStorage: 'usb' | 'phone' | 'both'
  const [scannerMode] = useState(() => localStorage.getItem('scannerMode') || 'both');
  const showUsb   = barcodeEnabled && (scannerMode === 'usb'   || scannerMode === 'both');
  const showPhone = barcodeEnabled && (scannerMode === 'phone' || scannerMode === 'both');

  const { items, addItem, clearCart } = useCartStore();
  const totals = useCartStore((s) => s.totals);

  const [barcodeInput,    setBarcodeInput]    = useState('');
  const [scanning,        setScanning]        = useState(false);
  const [showPayment,     setShowPayment]      = useState(false);
  const [showPhoneModal,  setShowPhoneModal]   = useState(false);
  const [showMobileCart,  setShowMobileCart]   = useState(false);

  const barcodeRef = useRef();

  // ── Phone scanner WebSocket hook ─────────────────────────────
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

  // Auto-focus barcode on mount
  useEffect(() => { barcodeRef.current?.focus(); }, []);

  // Re-focus barcode after adding items
  useEffect(() => {
    if (!showPayment) setTimeout(() => barcodeRef.current?.focus(), 100);
  }, [items.length, showPayment]);

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

  const totalItemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col md:flex-row gap-4 -mx-4 -my-6 p-4
                    md:h-[calc(100vh-5rem)] md:overflow-hidden">

      {/* ── LEFT: search / barcode ──────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 pb-24 md:pb-0">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 shrink-0">POS Terminal</h1>

          {/* Phone scanner status badge */}
          {showPhone && phoneScanner.state !== 'idle' && (
            <button
              onClick={() => setShowPhoneModal(true)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium
                ${phoneScanner.state === 'phone_connected'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'}`}
            >
              {phoneScanner.state === 'phone_connected'
                ? <Wifi className="w-3 h-3" />
                : <WifiOff className="w-3 h-3" />
              }
              {phoneScanner.state === 'phone_connected' ? 'Phone connected' : 'Waiting...'}
            </button>
          )}
        </div>

        {readOnly && (
          <div className="text-sm bg-yellow-50 border border-yellow-200 text-yellow-800
                          rounded-lg px-3 py-2 shrink-0">
            Read-only mode - sales disabled. Renew subscription.
          </div>
        )}

        {/* USB Barcode input */}
        {showUsb && (
          <form onSubmit={handleBarcodeSubmit} className="shrink-0">
            <label className="label flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-gray-400" />
              Barcode scan (USB)
            </label>
            <div className="flex gap-2">
              <input
                ref={barcodeRef}
                className="input font-mono flex-1"
                placeholder="Scan or type barcode, then press Enter..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                disabled={readOnly}
                autoComplete="off"
              />
              <button type="submit" className="btn-secondary shrink-0" disabled={readOnly || scanning}>
                Add
              </button>
            </div>
          </form>
        )}

        {/* Phone scanner button */}
        {showPhone && !readOnly && (
          <div className="shrink-0">
            <label className="label flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-gray-400" />
              Phone Scanner (Wireless)
            </label>
            <button
              onClick={() => setShowPhoneModal(true)}
              className={`btn-secondary w-full sm:w-auto flex items-center gap-2 text-sm
                ${phoneScanner.state === 'phone_connected' ? 'border-green-300 text-green-700' : ''}`}
            >
              {phoneScanner.state === 'phone_connected'
                ? <><Wifi className="w-4 h-4 text-green-500" /> Phone connected - tap to manage</>
                : phoneScanner.state === 'waiting'
                ? <><WifiOff className="w-4 h-4 text-yellow-500" /> Waiting for phone...</>
                : <><Smartphone className="w-4 h-4" /> Connect Phone Scanner</>
              }
            </button>
          </div>
        )}

        {/* Product search */}
        <div className="shrink-0">
          <label className="label">Search by name</label>
          <ProductSearch onSelect={(p) => !readOnly && addItem(p)} />
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-3
                          md:flex hidden">
            <ShoppingCart className="w-16 h-16" />
            <p className="text-sm">
              {barcodeEnabled
                ? 'Scan a barcode or search to add products'
                : 'Search to add products'}
            </p>
          </div>
        )}
      </div>

      {/* ── RIGHT: cart (desktop only) ───────────────────────── */}
      <div className="hidden md:flex w-80 xl:w-96 flex-col bg-white border border-gray-200
                      rounded-xl shadow-sm overflow-hidden shrink-0">
        <CartPanel
          onPayClick={() => setShowPayment(true)}
        />
      </div>

      {/* ── MOBILE: floating cart button ──────────────────────── */}
      <div className="md:hidden fixed bottom-20 left-4 right-4 z-30">
        <button
          onClick={() => setShowMobileCart(true)}
          className="w-full btn-primary py-3 justify-between text-base shadow-lg rounded-xl"
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
            {/* Drag handle */}
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

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal
          totals={totals}
          items={items}
          onClose={() => setShowPayment(false)}
          onComplete={() => {
            setShowPayment(false);
            clearCart();
            barcodeRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
