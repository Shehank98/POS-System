/**
 * ScannedItemsSection
 *
 * Scrollable card list of items scanned via POSScannerSection,
 * with qty controls, a real-time subtotal, and a full-width
 * "Proceed to Payment" button fixed at the bottom.
 *
 * Cart state lives entirely in local useState — no Zustand, no server.
 *
 * ── How to connect to POSScannerSection ──────────────────────────────
 *
 *   const cartRef = useRef();
 *
 *   <POSScannerSection
 *     onItemScanned={(barcode) => cartRef.current?.handleBarcode(barcode)}
 *   />
 *   <ScannedItemsSection
 *     ref={cartRef}
 *     onProceed={(items, total) => openPaymentModal(items, total)}
 *   />
 *
 * The component resolves each barcode via productsApi.byBarcode and
 * exposes handleBarcode through a forwarded ref so the parent can wire
 * the two components together with a single line.
 */

import { forwardRef, useImperativeHandle, useState, useCallback, useRef } from 'react';
import {
  Plus, Minus, Trash2, ShoppingBag, ArrowRight,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../api/client';

const fmt = (n) => Number(n || 0).toFixed(2);

/* ── Colour palette for thumbnail initials ─────────────────────────────────
   12 hues — same order as the accent strip in POSScannerSection so items
   get a visually consistent colour when seen in both places.              */
const PALETTE = [
  { bg: 'bg-red-100',    text: 'text-red-600',    ring: 'ring-red-200'    },
  { bg: 'bg-orange-100', text: 'text-orange-600', ring: 'ring-orange-200' },
  { bg: 'bg-amber-100',  text: 'text-amber-600',  ring: 'ring-amber-200'  },
  { bg: 'bg-lime-100',   text: 'text-lime-700',   ring: 'ring-lime-200'   },
  { bg: 'bg-green-100',  text: 'text-green-700',  ring: 'ring-green-200'  },
  { bg: 'bg-teal-100',   text: 'text-teal-700',   ring: 'ring-teal-200'   },
  { bg: 'bg-cyan-100',   text: 'text-cyan-700',   ring: 'ring-cyan-200'   },
  { bg: 'bg-blue-100',   text: 'text-blue-700',   ring: 'ring-blue-200'   },
  { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200' },
  { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-200' },
  { bg: 'bg-pink-100',   text: 'text-pink-700',   ring: 'ring-pink-200'   },
  { bg: 'bg-rose-100',   text: 'text-rose-700',   ring: 'ring-rose-200'   },
];
const thumbTheme = (name = '') =>
  PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length];

/* ════════════════════════════════════════════════════════════════════════════
   Sub-components
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Product thumbnail placeholder ─────────────────────────────────────── */
function Thumbnail({ name }) {
  const { bg, text, ring } = thumbTheme(name);
  return (
    <div
      className={`w-12 h-12 rounded-xl flex items-center justify-center
                  shrink-0 ring-1 ${bg} ${ring}`}
    >
      <span className={`text-lg font-bold leading-none ${text}`}>
        {(name?.[0] ?? '?').toUpperCase()}
      </span>
    </div>
  );
}

/* ── Single scanned-item card ───────────────────────────────────────────── */
function CartCard({ item, onQty, onRemove }) {
  const subtotal = item.price * item.qty;
  const atMin    = item.qty <= 1;

  return (
    <div
      className="flex items-center gap-3 bg-white rounded-2xl border
                 border-gray-100 shadow-sm px-4 py-3 animate-fade-in"
    >
      {/* Thumbnail */}
      <Thumbnail name={item.name} />

      {/* Name / category / qty controls */}
      <div className="flex-1 min-w-0">
        {/* Name */}
        <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
          {item.name}
        </p>

        {/* Category + unit price */}
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">
          {item.category || 'General'}&nbsp;·&nbsp;
          <span className="font-medium text-gray-500">{fmt(item.price)} ea.</span>
        </p>

        {/* Qty stepper */}
        <div className="flex items-center gap-2 mt-2">
          {/* Minus */}
          <button
            onClick={() => onQty(item.cartId, item.qty - 1)}
            aria-label="Decrease quantity"
            className={`w-7 h-7 rounded-full flex items-center justify-center
                        transition-all active:scale-90
                        ${atMin
                          ? 'bg-red-50  text-red-400   active:bg-red-100'
                          : 'bg-gray-100 text-gray-600 active:bg-gray-200'}`}
          >
            <Minus className="w-3 h-3" />
          </button>

          {/* Count */}
          <span className="w-6 text-center text-sm font-bold text-gray-900 tabular-nums">
            {item.qty}
          </span>

          {/* Plus */}
          <button
            onClick={() => onQty(item.cartId, item.qty + 1)}
            aria-label="Increase quantity"
            className="w-7 h-7 rounded-full bg-primary-100 text-primary-700
                       flex items-center justify-center transition-all
                       active:bg-primary-200 active:scale-90"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right column: delete button + subtotal */}
      <div className="flex flex-col items-end justify-between self-stretch
                      shrink-0 py-0.5 gap-2">
        {/* Delete */}
        <button
          onClick={() => onRemove(item.cartId)}
          aria-label={`Remove ${item.name}`}
          className="w-7 h-7 rounded-lg flex items-center justify-center
                     text-gray-300 hover:text-red-500 hover:bg-red-50
                     transition-colors active:scale-90"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Subtotal */}
        <span className="text-[15px] font-bold text-gray-900 tabular-nums">
          {fmt(subtotal)}
        </span>
      </div>
    </div>
  );
}

/* ── Skeleton card shown while barcode lookup is in-flight ──────────────── */
function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl border
                    border-gray-100 shadow-sm px-4 py-3 animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="w-12 h-12 rounded-xl bg-gray-200 shrink-0" />

      {/* Text lines */}
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded-lg w-3/4" />
        <div className="h-3 bg-gray-200 rounded-lg w-1/2" />
        {/* Stepper skeleton */}
        <div className="flex items-center gap-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-gray-200" />
          <div className="w-5 h-4 rounded bg-gray-200" />
          <div className="w-7 h-7 rounded-full bg-gray-200" />
        </div>
      </div>

      {/* Right skeleton */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gray-200" />
        <div className="w-14 h-5 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

/* ── Empty-cart illustration ────────────────────────────────────────────── */
function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-14
                    select-none">
      <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center
                      justify-center shadow-inner">
        <ShoppingBag className="w-9 h-9 text-gray-300" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-gray-400">Cart is empty</p>
        <p className="text-xs text-gray-300 max-w-[180px] leading-relaxed">
          Scan a barcode or tap&nbsp;
          <span className="text-gray-400 font-medium">Search manually</span>
          &nbsp;to add items
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Main component  (forwardRef so parent can call cartRef.current.handleBarcode)
   ════════════════════════════════════════════════════════════════════════════ */
const ScannedItemsSection = forwardRef(function ScannedItemsSection(
  { onProceed },
  ref,
) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);

  /* Prevent the same barcode from firing two concurrent API calls */
  const inFlight = useRef(new Set());

  /* ── barcode → product lookup → cart ────────────────────────────────── */
  const handleBarcode = useCallback(async (barcode) => {
    if (inFlight.current.has(barcode)) return;
    inFlight.current.add(barcode);
    setLoading(true);

    try {
      const { data } = await productsApi.byBarcode(barcode);

      setItems((prev) => {
        const existing = prev.find((i) => i.id === data.id);

        if (existing) {
          /* Item already in cart — bump qty */
          return prev.map((i) =>
            i.id === data.id ? { ...i, qty: i.qty + 1 } : i,
          );
        }

        /* New item — prepend so it appears at the top */
        return [
          { ...data, qty: 1, cartId: `${data.id}-${Date.now()}` },
          ...prev,
        ];
      });

      toast.success(`Added: ${data.name}`, { duration: 1500 });
    } catch {
      toast.error(`Barcode not found: ${barcode}`, { duration: 2500 });
    } finally {
      setLoading(false);
      inFlight.current.delete(barcode);
    }
  }, []);

  /* Expose handleBarcode so parent can write:
       cartRef.current.handleBarcode(barcode)                            */
  useImperativeHandle(ref, () => ({ handleBarcode }), [handleBarcode]);

  /* ── qty stepper / remove ────────────────────────────────────────────── */
  function setQty(cartId, newQty) {
    if (newQty < 1) {
      /* qty → 0  means remove */
      setItems((prev) => prev.filter((i) => i.cartId !== cartId));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.cartId === cartId ? { ...i, qty: newQty } : i)),
    );
  }

  function removeItem(cartId) {
    setItems((prev) => prev.filter((i) => i.cartId !== cartId));
  }

  /* ── derived totals ──────────────────────────────────────────────────── */
  const subtotal   = items.reduce((s, i) => s + i.price * i.qty, 0);
  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  const hasItems   = items.length > 0;

  /* ════════════════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════════════════ */
  return (
    /* Flex column that fills whatever height the parent gives it.
       The list grows; the bottom bar stays fixed at the bottom.           */
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50">

      {/* ── Cart header (only visible when there are items) ───────────── */}
      {hasItems && (
        <div className="flex items-center justify-between px-4 py-2.5
                        bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500
                             uppercase tracking-wide">
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </span>
            {loading && (
              <Loader2 className="w-3.5 h-3.5 text-primary-500 animate-spin" />
            )}
          </div>
          <button
            onClick={() => setItems([])}
            className="text-xs text-red-400 hover:text-red-600 font-medium
                       active:opacity-60 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Scrollable item list ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-3 pt-3 pb-2 space-y-2.5">

          {/* Skeleton while API call is in-flight (no items yet) */}
          {loading && items.length === 0 && <SkeletonCard />}

          {/* Loading indicator prepended above items when cart already
              has entries so the user sees something is happening        */}
          {loading && items.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary-50
                            rounded-xl border border-primary-100">
              <Loader2 className="w-4 h-4 text-primary-500 animate-spin shrink-0" />
              <p className="text-xs text-primary-600 font-medium">
                Looking up product…
              </p>
            </div>
          )}

          {/* Item cards */}
          {items.map((item) => (
            <CartCard
              key={item.cartId}
              item={item}
              onQty={setQty}
              onRemove={removeItem}
            />
          ))}

          {/* Empty state */}
          {!loading && !hasItems && <EmptyCart />}
        </div>
      </div>

      {/* ── Sticky bottom: subtotal row + Proceed button ─────────────── */}
      <div className="shrink-0 bg-white border-t border-gray-200">

        {/* Subtotal row */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2.5">
          <span className="text-sm font-medium text-gray-500">Subtotal</span>
          <span className="text-2xl font-bold text-gray-900 tabular-nums
                           tracking-tight">
            {fmt(subtotal)}
          </span>
        </div>

        {/* Proceed button */}
        <div className="px-3 pb-4">
          <button
            onClick={() => onProceed?.(items, subtotal)}
            disabled={!hasItems}
            className="w-full flex items-center justify-between
                       px-5 py-4 rounded-2xl font-semibold text-base
                       bg-primary-600 text-white
                       shadow-lg shadow-primary-600/25
                       transition-all duration-150
                       active:bg-primary-700 active:scale-[0.985]
                       disabled:opacity-35 disabled:cursor-not-allowed
                       disabled:shadow-none"
          >
            <span>Proceed to Payment</span>

            <div className="flex items-center gap-2">
              {/* Item-count badge */}
              {hasItems && (
                <span className="bg-white/20 text-white text-xs font-bold
                                 px-2 py-0.5 rounded-full tabular-nums
                                 min-w-[22px] text-center">
                  {totalItems}
                </span>
              )}
              <ArrowRight className="w-5 h-5" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
});

export default ScannedItemsSection;
