import { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronUp, Trash2, Tag, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { clothingApi } from '../../api/client';
import useAuthStore from '../../store/authStore';
import BarcodeField from './BarcodeField';

const fmt = (n) => Number(n || 0).toFixed(2);

const SIZES = ['XS','S','M','L','XL','XXL','XXXL','Free Size'];

const COLOR_CHIPS = [
  { label: 'Black',  hex: '#1f2937' },
  { label: 'White',  hex: '#f9fafb' },
  { label: 'Red',    hex: '#ef4444' },
  { label: 'Blue',   hex: '#3b82f6' },
  { label: 'Navy',   hex: '#1e3a8a' },
  { label: 'Grey',   hex: '#6b7280' },
  { label: 'Green',  hex: '#22c55e' },
  { label: 'Brown',  hex: '#92400e' },
  { label: 'Yellow', hex: '#eab308' },
  { label: 'Pink',   hex: '#ec4899' },
];

const CATEGORIES = [
  'T-Shirts','Shirts','Pants','Jeans','Dresses','Skirts',
  'Jackets','Shoes','Accessories',
];

// ── Variant row inside expanded product ──────────────────────
function VariantRow({ variant, onDelete, canEdit }) {
  const stock = variant.stock_quantity;
  const low   = stock > 0 && stock <= variant.low_stock_threshold;
  const out   = stock <= 0;

  return (
    <tr className="border-t border-gray-100 text-sm">
      <td className="py-2 px-3 font-medium">{variant.size}</td>
      <td className="py-2 px-3">{variant.color}</td>
      <td className="py-2 px-3 font-mono text-xs text-gray-400">{variant.sku || '—'}</td>
      <td className="py-2 px-3 font-mono text-xs text-gray-400">{variant.barcode || '—'}</td>
      <td className="py-2 px-3 text-right">
        {variant.price_override ? `Rs. ${fmt(variant.price_override)}` : '—'}
      </td>
      <td className="py-2 px-3 text-right">
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold
          ${out ? 'bg-red-100 text-red-600'
            : low ? 'bg-amber-100 text-amber-700'
            : 'bg-green-100 text-green-700'}`}>
          {stock}
        </span>
      </td>
      <td className="py-2 px-3 text-right">
        {canEdit && (
          <button onClick={() => onDelete(variant.id)}
            className="p-1 text-gray-300 hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Professional add-variant form ─────────────────────────────
function AddVariantForm({ productId, onAdded, onClose }) {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({
    size: '', customSize: '', color: '', barcode: '', sku: '',
    price_override: '', stock_quantity: 0, low_stock_threshold: 5,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const effectiveSize = form.size === 'Custom…' ? form.customSize : form.size;

  function stepStock(delta) {
    set('stock_quantity', Math.max(0, (parseInt(form.stock_quantity, 10) || 0) + delta));
  }

  async function submit(e) {
    e.preventDefault();
    if (!effectiveSize || !form.color) { toast.error('Size and color required'); return; }
    setSaving(true);
    try {
      const payload = {
        size:               effectiveSize,
        color:              form.color,
        barcode:            form.barcode  || null,
        sku:                form.sku      || null,
        price_override:     form.price_override ? parseFloat(form.price_override) : null,
        stock_quantity:     parseInt(form.stock_quantity, 10) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 5,
      };
      const { data } = await clothingApi.createVariant(productId, payload);
      toast.success('Variant added');
      onAdded(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add variant');
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Variant</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Left column — Attributes */}
        <div className="space-y-3">

          {/* Size */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Size *</label>
            <select
              className="input w-full text-sm py-1.5"
              value={form.size}
              onChange={(e) => set('size', e.target.value)}
            >
              <option value="">Select size…</option>
              {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="Custom…">Custom…</option>
            </select>
            {form.size === 'Custom…' && (
              <input
                autoFocus
                className="input w-full text-sm py-1.5 mt-1.5"
                placeholder="Enter custom size"
                value={form.customSize}
                onChange={(e) => set('customSize', e.target.value)}
              />
            )}
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Color *</label>
            <input
              className="input w-full text-sm py-1.5"
              placeholder="e.g. Black, Navy Blue"
              value={form.color}
              onChange={(e) => set('color', e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {COLOR_CHIPS.map(({ label, hex }) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  onClick={() => set('color', label)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border
                              transition-colors font-medium
                              ${form.color === label
                                ? 'border-primary-400 bg-primary-50 text-primary-700'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Stock */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Initial Stock</label>
              <div className="flex">
                <button type="button" onClick={() => stepStock(-1)}
                  className="px-2.5 py-1.5 border border-r-0 border-gray-200 rounded-l-lg
                             text-gray-500 hover:bg-gray-100 text-sm font-bold">
                  −
                </button>
                <input
                  type="number" min="0"
                  className="input text-center py-1.5 text-sm w-full rounded-none border-x-0"
                  value={form.stock_quantity}
                  onChange={(e) => set('stock_quantity', parseInt(e.target.value, 10) || 0)}
                />
                <button type="button" onClick={() => stepStock(1)}
                  className="px-2.5 py-1.5 border border-l-0 border-gray-200 rounded-r-lg
                             text-gray-500 hover:bg-gray-100 text-sm font-bold">
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Low Stock Alert</label>
              <input
                type="number" min="1"
                className="input w-full text-sm py-1.5 text-center"
                value={form.low_stock_threshold}
                onChange={(e) => set('low_stock_threshold', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Right column — Pricing & Barcode */}
        <div className="space-y-3">

          {/* Price override */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Price Override</label>
            <input
              type="number" min="0" step="0.01"
              className="input w-full text-sm py-1.5"
              placeholder="Inherits base price if blank"
              value={form.price_override}
              onChange={(e) => set('price_override', e.target.value)}
            />
          </div>

          {/* SKU */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">SKU</label>
            <input
              className="input w-full text-sm py-1.5 font-mono"
              placeholder="Auto-generated if blank"
              value={form.sku}
              onChange={(e) => set('sku', e.target.value)}
            />
          </div>

          {/* Barcode with scanner + QR preview */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Barcode</label>
            <BarcodeField
              value={form.barcode}
              onChange={(v) => set('barcode', v)}
              shopId={user?.shop_id}
              productId={productId}
              size={effectiveSize}
              color={form.color}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1 border-t border-gray-200">
        <button type="button" onClick={onClose} className="btn-secondary text-sm py-1.5">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5">
          {saving ? 'Adding…' : 'Add Variant'}
        </button>
      </div>
    </form>
  );
}

// ── Single product card with expandable variant table ─────────
function ProductCard({ product, canEdit, onRefresh, autoOpen }) {
  const [open,    setOpen]    = useState(false);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  async function loadVariants() {
    if (variants.length && open) { setOpen(false); return; }
    setLoading(true);
    try {
      const { data } = await clothingApi.listVariants(product.id);
      setVariants(data.variants);
      setOpen(true);
    } catch { toast.error('Failed to load variants'); }
    finally { setLoading(false); }
  }

  // Auto-open for newly created products
  useEffect(() => {
    if (autoOpen) {
      clothingApi.listVariants(product.id)
        .then(({ data }) => { setVariants(data.variants); setOpen(true); setShowAdd(true); })
        .catch(() => {});
    }
  }, []); // eslint-disable-line

  async function deleteVariant(id) {
    if (!window.confirm('Delete this variant?')) return;
    try {
      await clothingApi.deleteVariant(id);
      setVariants((v) => v.filter((x) => x.id !== id));
      toast.success('Variant deleted');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  }

  async function deleteProduct() {
    if (!window.confirm('Delete this product and all its variants?')) return;
    try {
      await clothingApi.deleteProduct(product.id);
      toast.success('Product deleted');
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  }

  async function printLabels() {
    const ids = variants.map((v) => v.id).join(',');
    if (!ids) { toast.error('No variants to print'); return; }
    try {
      const blob = await clothingApi.getBarcodeLabels(ids).then((r) => r.data);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `labels-${product.name}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to generate labels'); }
  }

  const totalStock = parseInt(product.total_stock, 10) || 0;
  const lowTotal   = totalStock > 0 && totalStock <= 15;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{product.name}</span>
            {product.is_clearance && (
              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">SALE</span>
            )}
            {product.category && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full hidden sm:inline">
                {product.category}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Rs. {fmt(product.base_price)} · {product.variant_count} variant{product.variant_count !== '1' ? 's' : ''}
            {' · '}
            <span className={lowTotal ? 'text-amber-600 font-medium' : ''}>
              {totalStock} in stock
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {open && variants.length > 0 && canEdit && (
            <button onClick={printLabels}
              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border
                         border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              <Tag className="w-3 h-3" /> Labels
            </button>
          )}
          {canEdit && (
            <button onClick={deleteProduct}
              className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={loadVariants}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
          >
            {loading
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
            }
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {variants.length > 0 ? (
            <table className="w-full text-left mt-2">
              <thead>
                <tr className="text-xs text-gray-400 uppercase">
                  <th className="pb-1.5 pr-3">Size</th>
                  <th className="pb-1.5 pr-3">Color</th>
                  <th className="pb-1.5 pr-3">SKU</th>
                  <th className="pb-1.5 pr-3">Barcode</th>
                  <th className="pb-1.5 pr-3 text-right">Price</th>
                  <th className="pb-1.5 pr-3 text-right">Stock</th>
                  <th className="pb-1.5 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <VariantRow key={v.id} variant={v} onDelete={deleteVariant} canEdit={canEdit} />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400 text-center py-3">No variants yet.</p>
          )}

          {canEdit && (
            showAdd
              ? <AddVariantForm
                  productId={product.id}
                  onAdded={(v) => setVariants((prev) => [...prev, v])}
                  onClose={() => setShowAdd(false)}
                />
              : <button onClick={() => setShowAdd(true)}
                  className="mt-3 flex items-center gap-1.5 text-sm text-primary-600
                             hover:text-primary-700 font-medium">
                  <Plus className="w-4 h-4" /> Add variant
                </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Professional add-product form ─────────────────────────────
function AddProductForm({ onAdded, onClose }) {
  const [form, setForm] = useState({
    name: '', category: '', customCategory: '',
    base_price: '', cost_price: '',
    tax_rate: 0, description: '', is_clearance: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const effectiveCategory = form.category === 'Other…' ? form.customCategory : form.category;

  async function submit(e) {
    e.preventDefault();
    if (!form.name) { toast.error('Product name is required'); return; }
    setSaving(true);
    try {
      const { data } = await clothingApi.createProduct({
        name:        form.name,
        category:    effectiveCategory,
        description: form.description,
        base_price:  parseFloat(form.base_price)  || 0,
        cost_price:  parseFloat(form.cost_price)  || 0,
        tax_rate:    parseFloat(form.tax_rate)     || 0,
        is_clearance: form.is_clearance,
      });
      toast.success('Product created');
      onAdded(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create product');
    } finally { setSaving(false); }
  }

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">New Clothing Product</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-5 text-sm">

        {/* Identity */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Product Details</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Product Name *</label>
            <input
              autoFocus
              className="input w-full py-1.5"
              placeholder="e.g. Classic T-Shirt, Slim Jeans"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                className="input w-full text-sm py-1.5"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
              >
                <option value="">Select category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="Other…">Other…</option>
              </select>
              {form.category === 'Other…' && (
                <input
                  className="input w-full text-sm py-1.5 mt-1.5"
                  placeholder="Enter custom category"
                  value={form.customCategory}
                  onChange={(e) => set('customCategory', e.target.value)}
                />
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea
              className="input w-full text-sm py-1.5 resize-none"
              rows={2}
              placeholder="Optional product description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pricing</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Base Price *</label>
              <input
                type="number" min="0" step="0.01"
                className="input w-full text-sm py-1.5"
                placeholder="0.00"
                value={form.base_price}
                onChange={(e) => set('base_price', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cost Price</label>
              <input
                type="number" min="0" step="0.01"
                className="input w-full text-sm py-1.5"
                placeholder="0.00"
                value={form.cost_price}
                onChange={(e) => set('cost_price', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tax Rate (%)</label>
              <input
                type="number" min="0" max="100" step="0.1"
                className="input w-full text-sm py-1.5"
                value={form.tax_rate}
                onChange={(e) => set('tax_rate', e.target.value)}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_clearance}
                  onChange={(e) => set('is_clearance', e.target.checked)}
                  className="w-4 h-4 accent-primary-600"
                />
                <span className="text-sm text-gray-600">Clearance / Sale</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-1.5">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5">
            {saving ? 'Saving…' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────
export default function ClothingProductsPanel({ canEdit }) {
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState('');
  const [showAdd,     setShowAdd]     = useState(false);
  const [newProductId, setNewProductId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (search)   params.search   = search;
      if (category) params.category = category;
      const { data } = await clothingApi.listProducts(params);
      setProducts(data.products);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">Clothing Products</h1>
        {canEdit && (
          <button onClick={() => setShowAdd((v) => !v)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          className="input py-1.5 text-sm h-9 flex-1 min-w-[160px]"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select
          className="input py-1.5 text-sm h-9"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={load} className="btn-secondary h-9 px-3 text-sm">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
        </button>
      </div>

      {showAdd && (
        <AddProductForm
          onAdded={(p) => {
            setProducts((prev) => [p, ...prev]);
            setNewProductId(p.id);
            setShowAdd(false);
          }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {loading && !products.length ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No products yet. Click "Add Product" to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              canEdit={canEdit}
              onRefresh={load}
              autoOpen={p.id === newProductId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
