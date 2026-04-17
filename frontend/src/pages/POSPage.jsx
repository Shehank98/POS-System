import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Barcode, Search, X, Plus, Minus,
  ShoppingCart, Percent, CreditCard, Smartphone,
  Wifi, RefreshCw, Camera, QrCode, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore   from '../store/cartStore';
import useAuthStore   from '../store/authStore';
import { productsApi, preOrdersApi, clothingApi } from '../api/client';
import PaymentModal      from '../components/PaymentModal';
import usePosScanner     from '../hooks/usePosScanner';
import PhoneScannerModal from '../components/PhoneScannerModal';
import PosCameraScanner  from '../components/PosCameraScanner';
import VariantPickerModal from '../components/VariantPickerModal';

const fmt = (n) => Number(n || 0).toFixed(2);

function fmtWeight(kg) {
  const g = kg * 1000;
  if (g < 1000) return `${Math.round(g)}g`;
  return `${parseFloat(kg.toFixed(3))}kg`;
}

// ── Weight input modal for kg products ───────────────────────
function WeightInputModal({ product, onConfirm, onClose }) {
  const [input, setInput] = useState('');
  const [unit,  setUnit]  = useState('kg');
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  function parseWeight() {
    const raw = input.trim().toLowerCase();
    if (!raw) return null;
    if (raw.endsWith('kg')) {
      const v = parseFloat(raw);
      return isNaN(v) || v <= 0 ? null : v;
    }
    if (raw.endsWith('g')) {
      const v = parseFloat(raw);
      return isNaN(v) || v <= 0 ? null : v / 1000;
    }
    const v = parseFloat(raw);
    if (isNaN(v) || v <= 0) return null;
    return unit === 'g' ? v / 1000 : v;
  }

  function handleConfirm() {
    const kg = parseWeight();
    if (!kg) { toast.error('Enter a valid weight'); return; }
    onConfirm(kg);
  }

  const previewKg = parseWeight();
  const subtotal  = previewKg ? product.price * previewKg : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Enter Weight</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{product.name}</span>
            <span className="text-gray-400 ml-1">Rs. {fmt(product.price)}/kg</span>
          </p>
          {product.has_inventory && parseFloat(product.stock_quantity) > 0 &&
           parseFloat(product.stock_quantity) <= 10 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700 font-medium">
              Low stock: Only {parseFloat(product.stock_quantity).toFixed(2)} KG remaining
            </div>
          )}
          {product.has_inventory && parseFloat(product.stock_quantity) <= 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 font-medium">
              Out of stock
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="input flex-1 text-lg font-mono"
              placeholder={unit === 'kg' ? '0.5' : '500'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              type="number" min="0" step={unit === 'kg' ? '0.001' : '1'}
            />
            <div className="flex rounded-lg border border-gray-300 overflow-hidden shrink-0">
              {['g', 'kg'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-3 py-2 text-sm font-semibold transition-colors
                    ${unit === u ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {previewKg && (
            <p className="text-sm text-gray-500">
              Weight: <strong>{fmtWeight(previewKg)}</strong>
              {subtotal !== null && (
                <> &nbsp;·&nbsp; Total: <strong className="text-primary-700">Rs. {fmt(subtotal)}</strong></>
              )}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleConfirm}>Add to Cart</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Colour accent strip (by first letter, Tailwind classes kept literal for purge) ──
const ACCENTS = [
  'bg-red-400',    'bg-orange-400', 'bg-amber-400',  'bg-lime-500',
  'bg-green-500',  'bg-teal-400',   'bg-cyan-500',   'bg-blue-400',
  'bg-violet-500', 'bg-purple-400', 'bg-pink-400',   'bg-rose-400',
];
const accent = (name) => ACCENTS[(name.charCodeAt(0) || 0) % ACCENTS.length];

// ── Compact product card (no image — slim left accent strip) ───
function ProductCard({ product, onSelect, disabled }) {
  const qty        = parseFloat(product.stock_quantity) || 0;
  const outOfStock = product.has_inventory && qty <= 0;
  const lowStock   = product.has_inventory && qty > 0 && qty <= 10;

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
            {fmt(product.price)}{product.unit_type === 'kg' ? '/kg' : ''}
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
          {product.unit_type === 'kg'
            ? `${parseFloat(product.stock_quantity).toFixed(1)}kg`
            : product.stock_quantity}
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
    <li className="group px-4 py-3.5 border-b border-gray-100/80 last:border-0
                   hover:bg-gray-50/60 transition-colors duration-100">
      {/* Top row: name + delete */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${accent(item.name)}`} />
        <p className="text-[13px] font-semibold text-gray-900 leading-snug flex-1 min-w-0 pr-1">
          {item.name}
        </p>
        <button
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center
                     rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50
                     transition-all duration-150 shrink-0"
          onClick={() => onRemove(item.cartId)}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom row: qty stepper + unit price + discount + subtotal */}
      <div className="flex items-center gap-2 pl-4">
        {/* Pill stepper — for kg items show weight; for unit items show integer */}
        {item.unit_type === 'kg' ? (
          <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden shrink-0">
            <button
              className="w-7 h-7 flex items-center justify-center text-gray-500
                         hover:bg-gray-200 transition-colors"
              onClick={() => onQty(item.cartId, Math.max(0.001, item.quantity - 0.1))}
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              className="w-12 h-7 text-center text-[12px] font-bold text-gray-900
                         bg-transparent focus:outline-none"
              type="number" min="0.001" step="0.001"
              value={item.quantity}
              onChange={(e) => onQty(item.cartId, parseFloat(e.target.value) || 0.001)}
            />
            <button
              className="w-7 h-7 flex items-center justify-center text-gray-500
                         hover:bg-gray-200 transition-colors"
              onClick={() => onQty(item.cartId, item.quantity + 0.1)}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden shrink-0">
            <button
              className="w-7 h-7 flex items-center justify-center text-gray-500
                         hover:bg-gray-200 transition-colors"
              onClick={() => onQty(item.cartId, item.quantity - 1)}
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              className="w-8 h-7 text-center text-[13px] font-bold text-gray-900
                         bg-transparent focus:outline-none"
              type="number" min="1"
              value={item.quantity}
              onChange={(e) => onQty(item.cartId, parseInt(e.target.value, 10) || 1)}
            />
            <button
              className="w-7 h-7 flex items-center justify-center text-gray-500
                         hover:bg-gray-200 transition-colors"
              onClick={() => onQty(item.cartId, item.quantity + 1)}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}

        <span className="text-xs text-gray-400 flex-1 truncate">
          {item.unit_type === 'kg'
            ? `${fmtWeight(item.quantity)} × ${fmt(item.unit_price)}/kg`
            : `× ${fmt(item.unit_price)}`}
        </span>

        {/* Discount pill */}
        <button
          className={`flex items-center gap-0.5 text-xs rounded-md px-1.5 py-1 font-medium
                      transition-colors shrink-0
            ${item.discount_pct > 0
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
          onClick={() => { setEditDisc(true); setDiscInput(String(item.discount_pct)); }}
        >
          <Percent className="w-3 h-3" />
          {item.discount_pct > 0 ? `${item.discount_pct}%` : ''}
        </button>

        <span className="text-sm font-bold text-gray-900 min-w-[52px] text-right shrink-0">
          Rs. {fmt(item.subtotal)}
        </span>
      </div>

      {/* Inline discount editor */}
      {editDisc && (
        <div className="flex items-center gap-2 mt-2.5 ml-4 bg-amber-50 border border-amber-100
                        rounded-xl px-3 py-2">
          <Percent className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm font-semibold text-amber-800
                       focus:outline-none min-w-0 w-16"
            type="number" min="0" max="100" step="1"
            autoFocus
            value={discInput}
            onChange={(e) => setDiscInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitDiscount()}
          />
          <span className="text-xs text-amber-500 font-medium">%</span>
          <button
            className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white
                       rounded-lg px-2.5 py-1 transition-colors"
            onClick={commitDiscount}
          >
            Apply
          </button>
          <button
            className="text-xs text-amber-400 hover:text-amber-600 transition-colors"
            onClick={() => setEditDisc(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}

// ── Cart panel (desktop sidebar + mobile drawer) ───────────────
function CartPanel({ onPayClick, onClose, clothingProps }) {
  const {
    items, orderDiscount,
    setQty, setItemDiscount, removeItem, setOrderDiscount, clearCart,
  } = useCartStore();
  const totals = useCartStore((s) => s.totals);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  // Scroll to top whenever the first item changes (new item added or re-added)
  const listRef = useRef(null);
  const firstItemId = items[0]?.cartId;
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [firstItemId]);

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-4 h-4 text-primary-600" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-bold text-gray-900">Order</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalQty > 0
                ? `${totalQty} item${totalQty !== 1 ? 's' : ''}`
                : 'Empty'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <button
              className="text-xs text-gray-400 hover:text-red-500 hover:bg-red-50
                         px-2 py-1 rounded-lg transition-colors font-medium"
              onClick={clearCart}
            >
              Clear
            </button>
          )}
          {onClose && (
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400
                         hover:text-gray-600 hover:bg-gray-100 transition-colors"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Items list ── */}
      <ul ref={listRef} className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <li className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <ShoppingCart className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-400">Cart is empty</p>
            <p className="text-xs text-gray-300 mt-1">Tap a product to add it</p>
          </li>
        ) : (
          items.map((item) => (
            <CartRow
              key={item.cartId}
              item={item}
              onQty={setQty}
              onDiscount={setItemDiscount}
              onRemove={removeItem}
            />
          ))
        )}
      </ul>

      {/* Clothing: customer loyalty bar */}
      {clothingProps && (
        <CustomerLoyaltyBar {...clothingProps} />
      )}

      {/* ── Totals + Charge ── */}
      <div className="border-t border-gray-100 bg-gray-50/50 shrink-0">
        <div className="px-4 pt-3 pb-2 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium text-gray-700">Rs. {fmt(totals.itemsSubtotal)}</span>
          </div>

          {totals.itemsDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-amber-600">Item discounts</span>
              <span className="font-medium text-amber-600">−Rs. {fmt(totals.itemsDiscount)}</span>
            </div>
          )}

          {totals.taxAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tax</span>
              <span className="font-medium text-gray-700">+Rs. {fmt(totals.taxAmount)}</span>
            </div>
          )}

          {/* Order discount */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Order discount</span>
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-xs">Rs.</span>
              <input
                className="w-20 h-7 text-sm text-right bg-white border border-gray-200
                           rounded-lg px-2 focus:border-primary-300 focus:outline-none
                           focus:ring-2 focus:ring-primary-100 transition-colors"
                type="number" min="0" step="0.01" placeholder="0.00"
                value={orderDiscount || ''}
                onChange={(e) => setOrderDiscount(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Total row */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
          <span className="font-bold text-gray-900">Total</span>
          <span className="text-xl font-extrabold text-primary-700">Rs. {fmt(totals.grandTotal)}</span>
        </div>

        {/* Charge button */}
        <div className="px-4 pb-4 pt-2">
          <button
            className="w-full flex items-center justify-between
                       bg-primary-600 hover:bg-primary-700 active:bg-primary-800
                       text-white rounded-xl px-5 py-3.5 shadow-sm
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={items.length === 0}
            onClick={onPayClick}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-5 h-5" />
              <span className="text-base font-semibold">Charge</span>
            </div>
            <span className="text-lg font-extrabold">Rs. {fmt(totals.grandTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Clothing customer loyalty bar ─────────────────────────────
function CustomerLoyaltyBar({ phone, setPhone, customerData, onLookup, pointsToRedeem, setPointsToRedeem }) {
  const maxRedeem = customerData ? Math.min(customerData.loyalty_points, 500) : 0;
  const discount  = Math.floor(pointsToRedeem / 100);

  return (
    <div className="px-4 py-3 border-t border-primary-100 bg-primary-50/50 shrink-0">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-primary-500 shrink-0" />
        <input
          className="input py-1 h-8 text-sm flex-1 min-w-0"
          placeholder="Customer phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={onLookup}
          onKeyDown={(e) => e.key === 'Enter' && onLookup()}
        />
      </div>
      {customerData && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-primary-700 font-medium">
              {customerData.name || phone} · {customerData.loyalty_points} pts
            </span>
            {customerData.loyalty_points >= 100 && (
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pointsToRedeem > 0}
                  onChange={(e) => setPointsToRedeem(e.target.checked ? maxRedeem : 0)}
                  className="w-3.5 h-3.5 accent-primary-600"
                />
                <span className="text-primary-600 font-semibold">
                  Redeem {maxRedeem} pts (−Rs. {discount}.00)
                </span>
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main POS Page ─────────────────────────────────────────────
export default function POSPage() {
  const user           = useAuthStore((s) => s.user);
  const barcodeEnabled = user?.barcode_enabled ?? false;
  const readOnly       = user?.read_only ?? false;
  const isClothing     = user?.shop_type === 'clothing';

  const [scannerMode] = useState(() => localStorage.getItem('scannerMode') || 'both');
  // Clothing shops always show all scanner options — barcode is the primary input method
  const showUsb   = isClothing || (barcodeEnabled && (scannerMode === 'usb'   || scannerMode === 'both'));
  const showPhone = isClothing || (barcodeEnabled && (scannerMode === 'phone' || scannerMode === 'both'));

  const { items, addItem, clearCart } = useCartStore();
  const totals = useCartStore((s) => s.totals);

  // Product browser state
  const [allProducts,    setAllProducts]    = useState([]);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loadingProds,   setLoadingProds]   = useState(false);

  // Clothing variant picker
  const [variantProduct,  setVariantProduct]  = useState(null); // { product, variants }
  // Clothing customer / loyalty
  const [customerPhone,   setCustomerPhone]   = useState('');
  const [customerData,    setCustomerData]    = useState(null); // { loyalty_points, name }
  const [pointsToRedeem,  setPointsToRedeem]  = useState(0);
  const [showCustomer,    setShowCustomer]    = useState(false);

  // UI state
  const [barcodeInput,   setBarcodeInput]   = useState('');
  const [scanning,       setScanning]       = useState(false);
  const [showPayment,    setShowPayment]     = useState(false);
  const [showPhoneModal, setShowPhoneModal]  = useState(false);
  const [showMobileCart, setShowMobileCart]  = useState(false);
  const [showCamera,     setShowCamera]      = useState(false);

  // Weight modal (for kg products)
  const [weightPending,  setWeightPending]  = useState(null); // product

  // Pre-order token lookup
  const [showPreOrder,   setShowPreOrder]   = useState(false);
  const [preOrderToken,  setPreOrderToken]  = useState('');
  const [loadingToken,   setLoadingToken]   = useState(false);
  const [activePreOrder, setActivePreOrder] = useState(null); // { id, token_number }

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

  // ── Load products (retail) or clothing parent products ───────
  function loadProducts() {
    setLoadingProds(true);
    const req = isClothing
      ? clothingApi.listProducts({ limit: 500 })
      : productsApi.list({ limit: 500 });
    req
      .then(({ data }) => setAllProducts(data.products))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoadingProds(false));
  }

  // ── Clothing: lookup customer loyalty ────────────────────────
  async function lookupCustomer() {
    const phone = customerPhone.trim();
    if (!phone) return;
    try {
      const { data } = await clothingApi.getCustomer(phone);
      setCustomerData(data);
      toast.success(`${data.name || phone} — ${data.loyalty_points} pts`);
    } catch {
      setCustomerData({ loyalty_points: 0 });
    }
  }

  // ── Clothing: open variant picker ────────────────────────────
  async function openVariantPicker(product) {
    if (readOnly) return;
    try {
      const { data } = await clothingApi.listVariants(product.id);
      setVariantProduct({ product, variants: data.variants });
    } catch {
      toast.error('Could not load variants');
    }
  }

  // ── Clothing: add variant to cart ────────────────────────────
  function addVariantToCart(variant) {
    if (!variantProduct) return;
    const { product } = variantProduct;
    const cartItem = {
      id:                   variant.id,
      clothing_variant_id:  variant.id,
      name:                 `${product.name} / ${variant.color} / ${variant.size}`,
      effective_price:      parseFloat(variant.effective_price ?? variant.price_override ?? product.base_price),
      tax_rate:             parseFloat(product.tax_rate) || 0,
      is_clearance:         product.is_clearance || false,
      unit_type:            'unit',
    };
    addItem(cartItem);
    toast.success(`Added: ${cartItem.name}`);
  }

  useEffect(() => {
    loadProducts();
    barcodeRef.current?.focus();
  }, []); // eslint-disable-line

  // ── Barcode resolver (clothing-aware) ────────────────────────
  const resolveBarcode = useCallback(async (code) => {
    if (isClothing) {
      const { data } = await clothingApi.getVariantByBarcode(code);
      const cartItem = {
        id:                  data.variant.id,
        clothing_variant_id: data.variant.id,
        name:                `${data.product.name} / ${data.variant.color} / ${data.variant.size}`,
        effective_price:     data.effective_price,
        tax_rate:            parseFloat(data.product.tax_rate) || 0,
        is_clearance:        data.product.is_clearance || false,
        unit_type:           'unit',
      };
      addItem(cartItem);
      toast.success(`Added: ${cartItem.name}`);
    } else {
      const { data } = await productsApi.byBarcode(code);
      if (data.unit_type === 'kg') { setWeightPending(data); return; }
      addItem(data);
      toast.success(`Added: ${data.name}`);
    }
  }, [addItem, isClothing]);

  // ── Phone scanner WebSocket ──────────────────────────────────
  const handlePhoneBarcode = useCallback(async (code) => {
    if (readOnly) return;

    // Auto-detect pre-order token (e.g. A001)
    if (/^[A-Za-z]\d{3}$/.test(code)) {
      setPreOrderToken(code.toUpperCase());
      setShowPreOrder(true);
      return;
    }

    try {
      await resolveBarcode(code);
    } catch {
      toast.error(`Barcode "${code}" not found`);
    }
  }, [resolveBarcode, readOnly]);

  const phoneScanner = usePosScanner({ onBarcode: handlePhoneBarcode });

  // ── USB barcode submit ────────────────────────────────────────
  async function handleBarcodeSubmit(e) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    if (!isClothing && /^[A-Za-z]\d{3}$/.test(code)) {
      setBarcodeInput('');
      setPreOrderToken(code.toUpperCase());
      setShowPreOrder(true);
      return;
    }

    setScanning(true);
    try {
      await resolveBarcode(code);
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
    if (isClothing) { openVariantPicker(product); return; }
    if (product.unit_type === 'kg') { setWeightPending(product); return; }
    addItem(product);
  }

  async function loadPreOrder() {
    const token = preOrderToken.trim().toUpperCase();
    if (!token) { toast.error('Enter a token number'); return; }
    setLoadingToken(true);
    try {
      const { data } = await preOrdersApi.getByToken(token);
      const order = data.order;
      const orderItems = Array.isArray(order.items) ? order.items : [];
      // Match items to loaded products and add to cart
      let added = 0;
      orderItems.forEach((item) => {
        const match = allProducts.find((p) => p.id === item.product_id);
        if (match) {
          addItem(match, item.quantity || 1);
          added++;
        }
      });
      if (added === 0) {
        toast.error('No matching products found in this order');
        return;
      }
      setActivePreOrder({ id: order.id, token_number: order.token_number });
      setShowPreOrder(false);
      setPreOrderToken('');
      toast.success(`Token ${order.token_number} loaded — ${added} item(s) added to cart`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Token not found');
    } finally {
      setLoadingToken(false);
    }
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
            {(barcodeEnabled || isClothing) && !readOnly && (
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
            {/* Pre Orders token lookup */}
            {!readOnly && (
              <button
                onClick={() => setShowPreOrder((v) => !v)}
                title="Load pre-order by token"
                className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border font-medium transition-colors
                  ${activePreOrder
                    ? 'bg-primary-50 border-primary-300 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {activePreOrder ? activePreOrder.token_number : 'Pre Orders'}
                </span>
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

        {/* Pre-order token search panel */}
        {showPreOrder && !readOnly && (
          <div className="px-3 py-2.5 bg-primary-50 border-b border-primary-100 shrink-0">
            <p className="text-xs font-semibold text-primary-700 mb-1.5">Load Pre-Order by Token</p>
            <div className="flex gap-2">
              <input
                autoFocus
                className="input py-1.5 text-sm font-mono h-8 flex-1 uppercase"
                placeholder="e.g. A001"
                value={preOrderToken}
                onChange={(e) => setPreOrderToken(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && loadPreOrder()}
                maxLength={5}
              />
              <button
                onClick={loadPreOrder}
                disabled={loadingToken}
                className="btn-primary h-8 px-3 text-xs shrink-0 disabled:opacity-60"
              >
                {loadingToken ? 'Loading...' : 'Load Order'}
              </button>
              <button
                onClick={() => { setShowPreOrder(false); setPreOrderToken(''); }}
                className="h-8 px-2 text-gray-400 hover:text-gray-600 rounded-lg border border-gray-200 bg-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {activePreOrder && (
              <p className="text-xs text-primary-600 mt-1.5 font-medium">
                ✓ Token <strong>{activePreOrder.token_number}</strong> is loaded. Complete payment to finish.
              </p>
            )}
          </div>
        )}

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
        {/* pb-28 = 112px: bottom nav 56px + cart button ~52px + 4px gap */}
        <div className="flex-1 overflow-y-auto px-3 pb-28 md:pb-4">
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
        <CartPanel
          onPayClick={() => setShowPayment(true)}
          clothingProps={isClothing ? {
            phone: customerPhone, setPhone: setCustomerPhone,
            customerData, onLookup: lookupCustomer,
            pointsToRedeem, setPointsToRedeem,
          } : null}
        />
      </div>

      {/* ── MOBILE: floating cart button ── */}
      <div className="md:hidden fixed bottom-[3.75rem] left-0 right-0 z-30 px-3 pointer-events-none">
        <button
          className="w-full flex items-center justify-between
                     bg-primary-600 hover:bg-primary-700 active:bg-primary-800
                     text-white rounded-2xl px-4 py-3.5 shadow-xl pointer-events-auto
                     transition-colors"
          onClick={() => setShowMobileCart(true)}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              {totalItemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white text-primary-700
                                 rounded-full text-[10px] font-extrabold flex items-center
                                 justify-center leading-none">
                  {totalItemCount > 9 ? '9+' : totalItemCount}
                </span>
              )}
            </div>
            <span className="text-sm font-semibold">
              {totalItemCount > 0
                ? `${totalItemCount} item${totalItemCount !== 1 ? 's' : ''}`
                : 'Cart is empty'}
            </span>
          </div>
          <span className="text-base font-extrabold">Rs. {fmt(totals.grandTotal)}</span>
        </button>
      </div>

      {/* ── MOBILE: cart drawer ───────────────────────────────── */}
      {showMobileCart && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMobileCart(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[88vh] bg-white
                       rounded-t-3xl overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <CartPanel
                onPayClick={() => { setShowMobileCart(false); setShowPayment(true); }}
                onClose={() => setShowMobileCart(false)}
                clothingProps={isClothing ? {
                  phone: customerPhone, setPhone: setCustomerPhone,
                  customerData, onLookup: lookupCustomer,
                  pointsToRedeem, setPointsToRedeem,
                } : null}
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

      {/* Weight input modal for kg products */}
      {weightPending && (
        <WeightInputModal
          product={weightPending}
          onConfirm={(kg) => {
            addItem(weightPending, kg);
            toast.success(`Added: ${weightPending.name} (${fmtWeight(kg)})`);
            setWeightPending(null);
          }}
          onClose={() => setWeightPending(null)}
        />
      )}

      {/* Clothing: variant picker modal */}
      {variantProduct && (
        <VariantPickerModal
          product={variantProduct.product}
          variants={variantProduct.variants}
          onSelect={addVariantToCart}
          onClose={() => setVariantProduct(null)}
        />
      )}

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal
          totals={totals}
          items={items}
          onClose={() => setShowPayment(false)}
          onComplete={async () => {
            if (activePreOrder) {
              try {
                await preOrdersApi.updateStatus(activePreOrder.id, 'COMPLETED');
                toast.success(`Pre-order ${activePreOrder.token_number} marked complete`);
              } catch {
                toast.error('Payment done but could not update pre-order status. Please mark it manually.');
              }
              setActivePreOrder(null);
            }
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
