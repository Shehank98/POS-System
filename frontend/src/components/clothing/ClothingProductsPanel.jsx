import { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronUp, Pencil, Trash2, Tag, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { clothingApi } from '../../api/client';

const fmt = (n) => Number(n || 0).toFixed(2);

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

// ── Add variant form ─────────────────────────────────────────
function AddVariantForm({ productId, onAdded, onClose }) {
  const [form, setForm] = useState({
    size: '', color: '', barcode: '', sku: '',
    price_override: '', stock_quantity: 0, low_stock_threshold: 5,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.size || !form.color) { toast.error('Size and color required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price_override: form.price_override ? parseFloat(form.price_override) : null,
        stock_quantity: parseInt(form.stock_quantity, 10) || 0,
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
    <form onSubmit={submit} className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        {[['size','Size *'],['color','Color *'],['barcode','Barcode'],
          ['sku','SKU'],['price_override','Price override'],['stock_quantity','Initial stock']
        ].map(([k, label]) => (
          <div key={k}>
            <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
            <input
              className="input py-1 text-sm w-full"
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3 justify-end">
        <button type="button" onClick={onClose} className="btn-secondary text-sm py-1.5">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5">
          {saving ? 'Adding…' : 'Add Variant'}
        </button>
      </div>
    </form>
  );
}

// ── Single product card with expandable variant table ─────────
function ProductCard({ product, canEdit, onRefresh }) {
  const [open,      setOpen]      = useState(false);
  const [variants,  setVariants]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [showAdd,   setShowAdd]   = useState(false);

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
      {/* Product header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
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

      {/* Expandable variants */}
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

// ── Add product form ─────────────────────────────────────────
function AddProductForm({ onAdded, onClose }) {
  const [form, setForm] = useState({
    name: '', category: '', base_price: '', cost_price: '',
    tax_rate: 0, description: '', is_clearance: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { data } = await clothingApi.createProduct({
        ...form,
        base_price: parseFloat(form.base_price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        tax_rate:   parseFloat(form.tax_rate)   || 0,
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
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        {[
          ['name','Product Name *','text',2],
          ['category','Category','text',1],
          ['base_price','Base Price','number',1],
          ['cost_price','Cost Price','number',1],
          ['tax_rate','Tax Rate (%)','number',1],
          ['description','Description','text',2],
        ].map(([k, label, type, span]) => (
          <div key={k} className={span === 2 ? 'col-span-2' : ''}>
            <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
            <input
              type={type} className="input py-1.5 text-sm w-full"
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          </div>
        ))}
        <div className="flex items-center gap-2 col-span-1">
          <input type="checkbox" id="clearance" checked={form.is_clearance}
            onChange={(e) => set('is_clearance', e.target.checked)}
            className="w-4 h-4 accent-primary-600" />
          <label htmlFor="clearance" className="text-sm text-gray-600 cursor-pointer">Clearance / Sale</label>
        </div>
        <div className="col-span-full flex gap-2 justify-end">
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
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('');
  const [showAdd,  setShowAdd]  = useState(false);

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
          onChange={(e) => { setCategory(e.target.value); }}
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
          onAdded={(p) => { setProducts((prev) => [p, ...prev]); }}
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
            <ProductCard key={p.id} product={p} canEdit={canEdit} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
