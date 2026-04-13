import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Barcode, Search, X, Plus, Minus, Trash2,
  ShoppingCart, Percent, ChevronDown, CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore  from '../store/cartStore';
import useAuthStore  from '../store/authStore';
import { productsApi } from '../api/client';
import PaymentModal   from '../components/PaymentModal';

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
          placeholder="Search product by name…"
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
  const [editDisc, setEditDisc] = useState(false);
  const [discInput, setDiscInput] = useState(String(item.discount_pct));

  function commitDiscount() {
    onDiscount(item.cartId, discInput);
    setEditDisc(false);
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-2.5 border-b border-gray-100 last:border-0">
      {/* Row 1: name + remove */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 leading-snug flex-1">{item.name}</p>
        <button
          className="text-gray-300 hover:text-red-500 shrink-0 mt-0.5"
          onClick={() => onRemove(item.cartId)}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Row 2: qty controls + subtotal */}
      <div className="flex items-center justify-between gap-2">
        {/* Qty +/- */}
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

        <span className="text-xs text-gray-400">× {fmt(item.unit_price)}</span>

        {/* Discount */}
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

      {/* Inline discount editor */}
      {editDisc && (
        <div className="flex items-center gap-2 bg-orange-50 rounded px-2 py-1.5">
          <Percent className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <input
            className="input h-6 text-xs py-0 px-2 w-20"
            type="number"
            min="0"
            max="100"
            step="1"
            autoFocus
            value={discInput}
            onChange={(e) => setDiscInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitDiscount()}
          />
          <span className="text-xs text-orange-600">%</span>
          <button className="btn-primary text-xs py-0.5 px-2 h-6" onClick={commitDiscount}>
            OK
          </button>
          <button className="btn-secondary text-xs py-0.5 px-2 h-6"
                  onClick={() => setEditDisc(false)}>
            ✕
          </button>
        </div>
      )}
    </li>
  );
}

// ── Main POS Page ─────────────────────────────────────────────
export default function POSPage() {
  const user           = useAuthStore((s) => s.user);
  const barcodeEnabled = user?.barcode_enabled ?? false;
  const readOnly       = user?.read_only ?? false;

  const {
    items, orderDiscount,
    addItem, setQty, setItemDiscount, removeItem,
    setOrderDiscount, clearCart,
  } = useCartStore();

  const totals = useCartStore((s) => s.totals);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanning,     setScanning]     = useState(false);
  const [showPayment,  setShowPayment]  = useState(false);
  const barcodeRef = useRef();

  // Auto-focus barcode on mount
  useEffect(() => { barcodeRef.current?.focus(); }, []);

  // ── Barcode submit ───────────────────────────────────────��
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
      setBarcodeRef.current?.focus();
    }
  }

  // Give focus back to barcode field after adding a product
  const setBarcodeRef = { current: barcodeRef.current };
  useEffect(() => {
    if (!showPayment) setTimeout(() => barcodeRef.current?.focus(), 100);
  }, [items.length, showPayment]);

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-4 -mx-4 -my-6 p-4 overflow-hidden">
      {/* ── LEFT: search / barcode ──────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <h1 className="text-lg font-bold text-gray-900 shrink-0">POS Terminal</h1>

        {readOnly && (
          <div className="text-sm bg-yellow-50 border border-yellow-200 text-yellow-800
                          rounded-lg px-3 py-2 shrink-0">
            ⚠️ Read-only mode - sales disabled. Renew subscription.
          </div>
        )}

        {/* Barcode input */}
        {barcodeEnabled && (
          <form onSubmit={handleBarcodeSubmit} className="shrink-0">
            <label className="label flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-gray-400" />
              Barcode scan
            </label>
            <div className="flex gap-2">
              <input
                ref={barcodeRef}
                className="input font-mono flex-1"
                placeholder="Scan or type barcode, then press Enter…"
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

        {/* Product search */}
        <div className="shrink-0">
          <label className="label">Search by name</label>
          <ProductSearch onSelect={(p) => !readOnly && addItem(p)} />
        </div>

        {/* Empty state hint */}
        {items.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-3">
            <ShoppingCart className="w-16 h-16" />
            <p className="text-sm">
              {barcodeEnabled ? 'Scan a barcode or search to add products' : 'Search to add products'}
            </p>
          </div>
        )}
      </div>

      {/* ── RIGHT: cart ─────────────────────────────────────── */}
      <div className="w-80 xl:w-96 flex flex-col bg-white border border-gray-200 rounded-xl
                      shadow-sm overflow-hidden shrink-0">
        {/* Cart header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-800">
            Cart
            {items.length > 0 && (
              <span className="ml-2 text-xs bg-primary-100 text-primary-700 rounded-full
                               px-2 py-0.5">
                {items.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            )}
          </span>
          {items.length > 0 && (
            <button
              className="text-xs text-red-400 hover:text-red-600"
              onClick={clearCart}
            >
              Clear all
            </button>
          )}
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

        {/* ── Totals ─────────────────────────────────────── */}
        <div className="border-t border-gray-200 px-4 py-3 space-y-1.5 bg-gray-50">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{fmt(totals.itemsSubtotal)}</span>
          </div>
          {totals.itemsDiscount > 0 && (
            <div className="flex justify-between text-sm text-orange-600">
              <span>Item discounts</span>
              <span>-{fmt(totals.itemsDiscount)}</span>
            </div>
          )}
          {totals.taxAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax</span>
              <span>+{fmt(totals.taxAmount)}</span>
            </div>
          )}

          {/* Order-level discount */}
          <div className="flex items-center justify-between text-sm text-orange-600">
            <span>Order discount</span>
            <div className="flex items-center gap-1">
              <input
                className="w-20 h-6 text-xs text-right border border-orange-200 rounded px-1"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={orderDiscount || ''}
                onChange={(e) => setOrderDiscount(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-between font-bold text-gray-900 text-base pt-1
                          border-t border-gray-200">
            <span>Total</span>
            <span className="text-primary-700">{fmt(totals.grandTotal)}</span>
          </div>
        </div>

        {/* ── Pay button ──────────────────────────────────── */}
        <div className="px-4 pb-4 pt-2 bg-gray-50">
          <button
            className="btn-primary w-full justify-center py-3 text-base"
            disabled={items.length === 0 || readOnly}
            onClick={() => setShowPayment(true)}
          >
            <CreditCard className="w-5 h-5" /> Charge {fmt(totals.grandTotal)}
          </button>
        </div>
      </div>

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
