import { useState, useEffect, useRef } from 'react';
import { X, Barcode, Loader2, Camera, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../api/client';
import useAuthStore from '../store/authStore';
import CameraScanner from './CameraScanner';
import PhoneScannerModal from './PhoneScannerModal';
import usePosScanner from '../hooks/usePosScanner';

function emptyForm(defaultTaxRate = 0) {
  return {
    name:           '',
    barcode:        '',
    price:          '',
    cost_price:     '',
    stock_quantity: '',
    has_inventory:  true,
    category:       '',
    tax_rate:       defaultTaxRate > 0 ? String(defaultTaxRate) : '',
  };
}

export default function ProductForm({ product, onSaved, onClose }) {
  const user           = useAuthStore((s) => s.user);
  const barcodeEnabled = user?.barcode_enabled ?? false;
  const defaultTaxRate = user?.default_tax_rate ?? 0;
  const scannerMode    = localStorage.getItem('scannerMode') || 'both';
  const showPhone      = barcodeEnabled && (scannerMode === 'phone' || scannerMode === 'both');

  const [form,    setForm]    = useState(product ? {
    name:           product.name           || '',
    barcode:        product.barcode        || '',
    price:          product.price          ?? '',
    cost_price:     product.cost_price     ?? '',
    stock_quantity: product.stock_quantity ?? '',
    has_inventory:  product.has_inventory  ?? true,
    category:       product.category      || '',
    tax_rate:       product.tax_rate       ?? '',
  } : emptyForm(defaultTaxRate));
  const [saving,         setSaving]         = useState(false);
  const [errors,         setErrors]         = useState({});
  const [categories,     setCategories]     = useState([]);
  const [showCamera,     setShowCamera]     = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const barcodeRef = useRef();
  const nameRef    = useRef();

  const phoneScanner = usePosScanner({
    onBarcode: (code) => {
      setForm((f) => ({ ...f, barcode: code }));
      setShowPhoneModal(false);
      toast.success('Barcode scanned');
      nameRef.current?.focus();
    },
  });

  useEffect(() => {
    productsApi.categories().then(({ data }) => setCategories(data)).catch(() => {});
    // For existing products focus name; for new products let barcode autoFocus handle it
    if (product) nameRef.current?.focus();
  }, []);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
    setErrors((err) => ({ ...err, [field]: '' }));
  };

  function validate() {
    const e = {};
    if (!form.name.trim())         e.name  = 'Name is required';
    if (form.price === '')         e.price = 'Price is required';
    if (isNaN(Number(form.price))) e.price = 'Must be a number';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }

    const payload = {
      name:           form.name.trim(),
      barcode:        form.barcode.trim() || null,
      price:          parseFloat(form.price),
      cost_price:     parseFloat(form.cost_price) || 0,
      stock_quantity: form.has_inventory ? (parseInt(form.stock_quantity, 10) || 0) : 0,
      has_inventory:  form.has_inventory,
      category:       form.category.trim() || null,
      tax_rate:       parseFloat(form.tax_rate) || 0,
    };

    setSaving(true);
    try {
      if (product) {
        await productsApi.update(product.id, payload);
        toast.success('Product updated');
      } else {
        await productsApi.create(payload);
        toast.success('Product created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // When barcode field is focused (e.g. scanner fires Enter), move to next field
  function handleBarcodeKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
          <button className="p-1 rounded hover:bg-gray-100 text-gray-500" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Barcode — always shown; autoFocus when adding a new product so USB scanner works */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-gray-400" />
              Barcode
              <span className="text-xs text-gray-400 font-normal">(scan or type)</span>
            </label>
            <div className="flex gap-1.5">
              <input
                ref={barcodeRef}
                className="input font-mono flex-1"
                placeholder="Scan or type barcode…"
                value={form.barcode}
                onChange={set('barcode')}
                onKeyDown={handleBarcodeKey}
                autoFocus={!product}
              />
              {/* Camera scanner button */}
              <button
                type="button"
                title="Use device camera to scan barcode"
                onClick={() => setShowCamera(true)}
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg
                           border border-gray-300 bg-white text-gray-500
                           hover:bg-primary-50 hover:border-primary-400 hover:text-primary-600
                           transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              {/* Phone scanner button — only when barcode feature + phone mode enabled */}
              {showPhone && (
                <button
                  type="button"
                  title="Use connected phone to scan barcode"
                  onClick={() => { phoneScanner.connect(); setShowPhoneModal(true); }}
                  className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-lg
                              border transition-colors
                              ${phoneScanner.state === 'phone_connected'
                                ? 'bg-green-50 border-green-400 text-green-600'
                                : phoneScanner.state === 'waiting'
                                ? 'bg-yellow-50 border-yellow-400 text-yellow-600'
                                : 'border-gray-300 bg-white text-gray-500 hover:bg-primary-50 hover:border-primary-400 hover:text-primary-600'}`}
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Camera scanner overlay */}
          {showCamera && (
            <CameraScanner
              scannerId="product-form-cam"
              onScan={(code) => {
                setForm((f) => ({ ...f, barcode: code }));
                setShowCamera(false);
              }}
              onClose={() => setShowCamera(false)}
            />
          )}

          {/* Phone scanner modal */}
          {showPhoneModal && (
            <PhoneScannerModal
              state={phoneScanner.state}
              code={phoneScanner.code}
              onClose={() => setShowPhoneModal(false)}
              onConnect={phoneScanner.connect}
              onDisconnect={phoneScanner.disconnect}
              hint="Scan a barcode with your phone and it will fill the barcode field."
            />
          )}

          {/* Name */}
          <div>
            <label className="label">Product Name <span className="text-red-500">*</span></label>
            <input
              ref={nameRef}
              className={`input ${errors.name ? 'border-red-400' : ''}`}
              placeholder="e.g. Coca-Cola 330ml"
              value={form.name}
              onChange={set('name')}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="label">Category</label>
            <input
              className="input"
              list="category-list"
              placeholder="e.g. Beverages"
              value={form.category}
              onChange={set('category')}
            />
            <datalist id="category-list">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Price & Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Selling Price <span className="text-red-500">*</span></label>
              <input
                className={`input ${errors.price ? 'border-red-400' : ''}`}
                type="number" min="0" step="0.01"
                placeholder="0.00"
                value={form.price}
                onChange={set('price')}
              />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="label">Cost Price</label>
              <input
                className="input"
                type="number" min="0" step="0.01"
                placeholder="0.00"
                value={form.cost_price}
                onChange={set('cost_price')}
              />
            </div>
          </div>

          {/* Tax rate */}
          <div>
            <label className="label">Tax Rate (%)</label>
            <input
              className="input"
              type="number" min="0" max="100" step="0.01"
              placeholder="0"
              value={form.tax_rate}
              onChange={set('tax_rate')}
            />
          </div>

          {/* Inventory toggle */}
          <div className="flex items-center gap-3 py-1">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.has_inventory}
                onChange={set('has_inventory')}
              />
              <div className="w-10 h-5 bg-gray-200 rounded-full peer
                              peer-checked:bg-primary-600 after:content-['']
                              after:absolute after:top-0.5 after:left-0.5
                              after:bg-white after:rounded-full after:h-4 after:w-4
                              after:transition-all peer-checked:after:translate-x-5" />
            </label>
            <div>
              <span className="text-sm font-medium text-gray-700">Track inventory</span>
              <p className="text-xs text-gray-400">
                {form.has_inventory
                  ? 'Stock will decrease with each sale'
                  : 'Unlimited - stock is not tracked'}
              </p>
            </div>
          </div>

          {/* Stock quantity */}
          {form.has_inventory && (
            <div>
              <label className="label">Stock Quantity</label>
              <input
                className="input"
                type="number" min="0" step="1"
                placeholder="0"
                value={form.stock_quantity}
                onChange={set('stock_quantity')}
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : product ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
