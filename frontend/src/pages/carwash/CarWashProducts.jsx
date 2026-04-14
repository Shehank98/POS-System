import { useEffect, useState } from 'react';
import { Plus, Pencil, X, Loader2, Package, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { carwashApi } from '../../api/client';

const UNITS = ['pcs', 'bottle', 'ml', 'liter', 'kg', 'g', 'roll', 'box'];

function ProductForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, price: initial.price, stock_quantity: initial.stock_quantity, unit: initial.unit }
      : { name: '', price: '', stock_quantity: '', unit: 'pcs' }
  );
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{initial?.id ? 'Edit Product' : 'New Product'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Product Name *</label>
            <input type="text" required placeholder="e.g. Car Shampoo"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Price ($)</label>
              <input type="number" step="0.01" min="0" placeholder="0.00"
                value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stock Quantity</label>
            <input type="number" min="0" placeholder="0"
              value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function stockBadge(qty) {
  if (qty === 0)  return { label: 'Out of Stock', cls: 'bg-red-100 text-red-600' };
  if (qty < 5)    return { label: 'Low Stock',    cls: 'bg-orange-100 text-orange-600' };
  return null;
}

export default function CarWashProducts() {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    return carwashApi.listProducts({ include_inactive: 'true' })
      .then((r) => setProducts(r.data))
      .catch(() => {});
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function handleSave(form) {
    try {
      if (editing?.id) {
        await carwashApi.updateProduct(editing.id, form);
        toast.success('Product updated');
      } else {
        await carwashApi.createProduct(form);
        toast.success('Product created');
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    }
  }

  async function toggleActive(prod) {
    try {
      await carwashApi.updateProduct(prod.id, { is_active: !prod.is_active });
      setProducts((prev) => prev.map((p) => p.id === prod.id ? { ...p, is_active: !p.is_active } : p));
    } catch {
      toast.error('Failed to update product');
    }
  }

  const lowCount = products.filter((p) => p.is_active && p.stock_quantity < 5).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Products &amp; Stock</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {lowCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {lowCount} product{lowCount > 1 ? 's' : ''} running low on stock
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 text-gray-400">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No products yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((prod) => {
            const badge = stockBadge(prod.stock_quantity);
            return (
              <div key={prod.id}
                className={`flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100
                            ${!prod.is_active ? 'opacity-50' : ''}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{prod.name}</p>
                    {badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    ${parseFloat(prod.price).toFixed(2)}/{prod.unit}
                    {' · '}<strong className="text-gray-600">{prod.stock_quantity}</strong> in stock
                    {!prod.is_active && ' · Inactive'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => { setEditing(prod); setShowForm(true); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(prod)}
                    title={prod.is_active ? 'Deactivate' : 'Activate'}
                    className={`transition-colors ${prod.is_active ? 'text-blue-500 hover:text-gray-400' : 'text-gray-300 hover:text-blue-500'}`}
                  >
                    {prod.is_active
                      ? <ToggleRight className="w-6 h-6" />
                      : <ToggleLeft  className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProductForm
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
