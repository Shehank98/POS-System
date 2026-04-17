import { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronUp, Trash2, Tag, RefreshCw, X, Check, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { clothingApi } from '../../api/client';
import useAuthStore from '../../store/authStore';
import BarcodeField from './BarcodeField';

const fmt = (n) => Number(n || 0).toFixed(2);

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size'];

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
  { label: 'Orange', hex: '#f97316' },
  { label: 'Purple', hex: '#a855f7' },
];

const COLOR_MAP = Object.fromEntries(COLOR_CHIPS.map(({ label, hex }) => [label, hex]));

const CATEGORIES = [
  'T-Shirts', 'Shirts', 'Pants', 'Jeans', 'Dresses', 'Skirts',
  'Jackets', 'Shoes', 'Accessories',
];

// ── Download / print a PDF label for one or more variant IDs ──
async function downloadLabels(ids, filename) {
  try {
    const { data } = await clothingApi.getBarcodeLabels(
      Array.isArray(ids) ? ids.join(',') : String(ids)
    );
    const url = URL.createObjectURL(data);
    const a   = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Failed to generate label');
  }
}

// ── Variant row inside expanded product ──────────────────────
function VariantRow({ variant, productName, onDelete, onStockChange, canEdit }) {
  const [stock,     setStock]     = useState(variant.stock_quantity);
  const [adjusting, setAdjusting] = useState(false); // inline stock-adjust mode
  const [delta,     setDelta]     = useState('');
  const [saving,    setSaving]    = useState(false);

  const low = stock > 0 && stock <= variant.low_stock_threshold;
  const out = stock <= 0;
  const colorHex = COLOR_MAP[variant.color];

  async function applyDelta(d) {
    const n = parseInt(d, 10);
    if (!n) { toast.error('Enter a non-zero number'); return; }
    setSaving(true);
    try {
      const { data } = await clothingApi.adjustStock(variant.id, {
        delta:  n,
        reason: n > 0 ? 'received' : 'correction',
      });
      setStock(data.stock_quantity);
      onStockChange(variant.id, data.stock_quantity);
      setDelta('');
      setAdjusting(false);
      toast.success(`Stock updated → ${data.stock_quantity}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update stock');
    } finally { setSaving(false); }
  }

  return (
    <>
      <tr className="border-t border-gray-100 text-sm hover:bg-gray-50 transition-colors">
        <td className="py-2 px-3 font-semibold text-gray-700">{variant.size}</td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-1.5">
            {colorHex && (
              <span className="w-3 h-3 rounded-full border border-gray-200 shrink-0"
                style={{ backgroundColor: colorHex }} />
            )}
            <span className="text-gray-600">{variant.color}</span>
          </div>
        </td>
        <td className="py-2 px-3 font-mono text-xs text-gray-400">{variant.sku || '—'}</td>
        <td className="py-2 px-3 font-mono text-xs text-gray-400 max-w-[120px] truncate" title={variant.barcode}>
          {variant.barcode || <span className="text-gray-200">no barcode</span>}
        </td>
        <td className="py-2 px-3 text-right text-gray-700">
          {variant.price_override ? `Rs. ${fmt(variant.price_override)}` : <span className="text-gray-300">—</span>}
        </td>

        {/* Stock cell — click badge to open inline adjust */}
        <td className="py-2 px-3 text-right">
          <button
            onClick={() => setAdjusting((v) => !v)}
            title="Click to adjust stock"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                        transition-colors cursor-pointer
                        ${out  ? 'bg-red-100   text-red-600   hover:bg-red-200'
                        : low ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                               : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
          >
            {stock}
            <span className="text-[9px] opacity-60">±</span>
          </button>
        </td>

        <td className="py-2 px-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => downloadLabels(variant.id, `label-${productName}-${variant.size}-${variant.color}.pdf`)}
              title="Download CODE128 barcode label"
              className="p-1 text-gray-300 hover:text-indigo-500 transition-colors">
              <Tag className="w-3.5 h-3.5" />
            </button>
            {canEdit && (
              <button onClick={() => onDelete(variant.id)}
                className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Inline stock adjust row */}
      {adjusting && (
        <tr className="bg-indigo-50/60 border-t border-indigo-100">
          <td colSpan={7} className="px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 font-medium shrink-0">
                Adjust stock for <strong>{variant.size} / {variant.color}</strong>
                &nbsp;(current: <strong>{stock}</strong>)
              </span>
              <div className="flex items-center gap-1">
                {/* Quick preset buttons */}
                {[5, 10, 20, 50].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => applyDelta(n)}
                    disabled={saving}
                    className="px-2 py-1 text-xs rounded-lg bg-green-100 text-green-700
                               hover:bg-green-200 font-semibold transition-colors">
                    +{n}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  className="w-20 h-7 px-2 text-sm border border-indigo-200 rounded-lg
                             focus:outline-none focus:border-indigo-400 text-center font-mono"
                  placeholder="e.g. +10"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyDelta(delta); }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => applyDelta(delta)}
                  disabled={saving || !delta}
                  className="h-7 px-3 text-xs rounded-lg bg-indigo-600 text-white
                             hover:bg-indigo-700 disabled:opacity-40 font-semibold transition-colors">
                  {saving ? '…' : 'Apply'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAdjusting(false); setDelta(''); }}
                  className="h-7 px-2 text-xs rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                  Cancel
                </button>
              </div>
              <span className="text-[11px] text-gray-400">
                Use negative numbers to reduce (e.g. -3)
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── 3-step variant matrix builder ────────────────────────────
function AddVariantForm({ productId, basePrice, onAdded, onClose }) {
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(1);

  // Step 1 — sizes
  const [selSizes, setSelSizes]         = useState([]);
  const [extraSizeInput, setExtraSizeInput] = useState('');
  const [extraSizes, setExtraSizes]     = useState([]);

  // Step 2 — colors
  const [selColors, setSelColors]       = useState([]);
  const [extraColorInput, setExtraColorInput] = useState('');
  const [extraColors, setExtraColors]   = useState([]);

  // Step 3 — matrix rows
  const [rows, setRows]   = useState([]);
  const [saving, setSaving] = useState(false);

  // ── helpers ──
  function toggleSize(s) {
    setSelSizes((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  }

  function addExtraSize() {
    const s = extraSizeInput.trim();
    if (!s) return;
    if (!extraSizes.includes(s)) setExtraSizes((p) => [...p, s]);
    if (!selSizes.includes(s))   setSelSizes((p) => [...p, s]);
    setExtraSizeInput('');
  }

  function toggleColor(c) {
    setSelColors((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);
  }

  function addExtraColor() {
    const c = extraColorInput.trim();
    if (!c) return;
    if (!extraColors.includes(c)) setExtraColors((p) => [...p, c]);
    if (!selColors.includes(c))   setSelColors((p) => [...p, c]);
    setExtraColorInput('');
  }

  function makeBarcode(size, color) {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 4).toUpperCase();
    const s = (size  || '').replace(/\s+/g, '').slice(0, 3).toUpperCase() || 'X';
    const c = (color || '').replace(/\s+/g, '').slice(0, 3).toUpperCase() || 'X';
    return `${user?.shop_id || 0}-${productId}-${s}${c}-${ts}${rnd}`;
  }

  function goToColors() {
    if (!selSizes.length) { toast.error('Select at least one size'); return; }
    setStep(2);
  }

  function goToMatrix() {
    if (!selColors.length) { toast.error('Select at least one color'); return; }
    setRows(
      selSizes.flatMap((size) =>
        selColors.map((color) => ({
          size, color,
          stock: 0,
          low_stock_threshold: 5,
          price: '',
          barcode: makeBarcode(size, color),
        }))
      )
    );
    setStep(3);
  }

  function regenBarcodes() {
    setRows((p) => p.map((r) => ({ ...r, barcode: makeBarcode(r.size, r.color) })));
    toast.success('Barcodes regenerated');
  }

  function updateRow(i, field, value) {
    setRows((p) => p.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function stepStock(i, delta) {
    setRows((p) => p.map((r, idx) =>
      idx === i ? { ...r, stock: Math.max(0, (parseInt(r.stock, 10) || 0) + delta) } : r
    ));
  }

  async function saveAll() {
    setSaving(true);
    let ok = 0;
    const errs = [];
    for (const row of rows) {
      try {
        const { data } = await clothingApi.createVariant(productId, {
          size:                row.size,
          color:               row.color,
          barcode:             row.barcode || null,
          stock_quantity:      parseInt(row.stock, 10) || 0,
          low_stock_threshold: parseInt(row.low_stock_threshold, 10) || 5,
          price_override:      row.price ? parseFloat(row.price) : null,
        });
        onAdded(data);
        ok++;
      } catch (err) {
        errs.push(`${row.size}/${row.color}: ${err.response?.data?.error || 'failed'}`);
      }
    }
    setSaving(false);
    if (errs.length) toast.error(`${errs.length} failed: ${errs[0]}`);
    if (ok > 0) {
      toast.success(`${ok} variant${ok !== 1 ? 's' : ''} added`);
      onClose();
    }
  }

  // ── Step 1: Size selection ────────────────────────────────
  if (step === 1) return (
    <div className="mt-4 rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/50 to-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">1</span>
          <p className="text-sm font-semibold text-gray-700">Select Sizes</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-indigo-600 font-semibold">{selSizes.length} selected</span>
          <span className="text-xs text-gray-400">→ Step 1 of 3</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Preset sizes */}
        <div className="flex flex-wrap gap-2">
          {[...SIZES, ...extraSizes].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSize(s)}
              className={`relative px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all
                ${selSizes.includes(s)
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200 scale-105'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'}`}
            >
              {s}
              {selSizes.includes(s) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Custom size */}
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm py-1.5"
            placeholder="Custom size (e.g. 32, 36, One Size…)"
            value={extraSizeInput}
            onChange={(e) => setExtraSizeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtraSize(); } }}
          />
          <button type="button" onClick={addExtraSize}
            className="btn-secondary text-sm py-1.5 px-3 shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-between pt-1">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-1.5">Cancel</button>
          <button type="button" onClick={goToColors}
            className="btn-primary text-sm py-1.5 flex items-center gap-1.5">
            Next: Colors <ChevronDown className="w-3.5 h-3.5 rotate-[-90deg]" />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Step 2: Color selection ───────────────────────────────
  if (step === 2) return (
    <div className="mt-4 rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/50 to-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">2</span>
          <p className="text-sm font-semibold text-gray-700">Select Colors</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-indigo-600 font-semibold">{selColors.length} selected</span>
          <span className="text-xs text-gray-400">Step 2 of 3</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Preset + custom colors */}
        <div className="flex flex-wrap gap-2">
          {[...COLOR_CHIPS, ...extraColors.map((c) => ({ label: c, hex: '#9ca3af' }))].map(({ label, hex }) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleColor(label)}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all
                ${selColors.includes(label)
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm scale-105'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'}`}
            >
              <span
                className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
                style={{ backgroundColor: hex }}
              />
              {label}
              {selColors.includes(label) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Custom color */}
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm py-1.5"
            placeholder="Custom color (e.g. Maroon, Olive, Beige…)"
            value={extraColorInput}
            onChange={(e) => setExtraColorInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtraColor(); } }}
          />
          <button type="button" onClick={addExtraColor}
            className="btn-secondary text-sm py-1.5 px-3 shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {selSizes.length > 0 && selColors.length > 0 && (
          <div className="flex items-center gap-2 p-2.5 bg-indigo-50 rounded-lg border border-indigo-100 text-xs text-indigo-700">
            <Zap className="w-3.5 h-3.5 shrink-0" />
            Will generate <strong>{selSizes.length} × {selColors.length} = {selSizes.length * selColors.length} variants</strong>
            &nbsp;({selSizes.join(', ')} × {selColors.join(', ')})
          </div>
        )}

        <div className="flex justify-between pt-1">
          <button type="button" onClick={() => setStep(1)} className="btn-secondary text-sm py-1.5">← Back</button>
          <button type="button" onClick={goToMatrix}
            className="btn-primary text-sm py-1.5 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Generate {selSizes.length * selColors.length} Variants
          </button>
        </div>
      </div>
    </div>
  );

  // ── Step 3: Matrix configuration ─────────────────────────
  return (
    <div className="mt-4 rounded-xl border border-indigo-100 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 bg-indigo-50/50">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">3</span>
          <p className="text-sm font-semibold text-gray-700">
            Configure {rows.length} Variant{rows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={regenBarcodes}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium
                     px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <Zap className="w-3 h-3" /> Regen All Barcodes
        </button>
      </div>

      {/* Column headers */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[580px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="py-2 pl-4 pr-2 text-left text-gray-400 font-semibold uppercase tracking-wide w-16">Size</th>
              <th className="py-2 px-2 text-left text-gray-400 font-semibold uppercase tracking-wide w-28">Color</th>
              <th className="py-2 px-2 text-center text-gray-400 font-semibold uppercase tracking-wide w-24">Stock</th>
              <th className="py-2 px-2 text-center text-gray-400 font-semibold uppercase tracking-wide w-28">
                Price <span className="font-normal normal-case">(base: {basePrice ? `Rs.${fmt(basePrice)}` : '—'})</span>
              </th>
              <th className="py-2 pl-2 pr-4 text-left text-gray-400 font-semibold uppercase tracking-wide">Barcode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => {
              const colorHex = COLOR_MAP[row.color] || '#9ca3af';
              return (
                <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                  {/* Size */}
                  <td className="py-2 pl-4 pr-2">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 rounded-md font-bold text-gray-700">
                      {row.size}
                    </span>
                  </td>
                  {/* Color */}
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full border border-gray-200 shrink-0"
                        style={{ backgroundColor: colorHex }} />
                      <span className="text-gray-600 font-medium">{row.color}</span>
                    </div>
                  </td>
                  {/* Stock stepper */}
                  <td className="py-2 px-2">
                    <div className="flex items-center justify-center">
                      <button type="button" onClick={() => stepStock(i, -1)}
                        className="w-6 h-7 flex items-center justify-center border border-r-0 border-gray-200
                                   rounded-l-md text-gray-500 hover:bg-gray-100 font-bold text-sm">−</button>
                      <input
                        type="number" min="0"
                        className="w-10 h-7 text-center text-xs border border-gray-200 focus:outline-none
                                   focus:border-indigo-400 border-x-0"
                        value={row.stock}
                        onChange={(e) => updateRow(i, 'stock', e.target.value)}
                      />
                      <button type="button" onClick={() => stepStock(i, 1)}
                        className="w-6 h-7 flex items-center justify-center border border-l-0 border-gray-200
                                   rounded-r-md text-gray-500 hover:bg-gray-100 font-bold text-sm">+</button>
                    </div>
                  </td>
                  {/* Price override */}
                  <td className="py-2 px-2">
                    <input
                      type="number" min="0" step="0.01"
                      className="w-full h-7 px-2 text-xs border border-gray-200 rounded-md
                                 focus:outline-none focus:border-indigo-400 text-center"
                      placeholder="Base price"
                      value={row.price}
                      onChange={(e) => updateRow(i, 'price', e.target.value)}
                    />
                  </td>
                  {/* Barcode */}
                  <td className="py-2 pl-2 pr-4">
                    <input
                      className="w-full h-7 px-2 font-mono text-[10px] border border-gray-200 rounded-md
                                 focus:outline-none focus:border-indigo-400 text-gray-600"
                      value={row.barcode}
                      onChange={(e) => updateRow(i, 'barcode', e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center px-4 py-3 border-t border-gray-100 bg-gray-50">
        <button type="button" onClick={() => setStep(2)} className="btn-secondary text-sm py-1.5">← Back</button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{rows.length} variants ready</span>
          <button
            type="button"
            onClick={saveAll}
            disabled={saving}
            className="btn-primary text-sm py-1.5 flex items-center gap-1.5"
          >
            {saving
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              : <><Check className="w-3.5 h-3.5" /> Save {rows.length} Variant{rows.length !== 1 ? 's' : ''}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single product card with expandable variant table ─────────
function ProductCard({ product, canEdit, onRefresh, autoOpen }) {
  const [open,     setOpen]     = useState(false);
  const [variants, setVariants] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [showAdd,  setShowAdd]  = useState(false);

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

  function printLabels() {
    const ids = variants.map((v) => v.id);
    if (!ids.length) { toast.error('No variants to print'); return; }
    downloadLabels(ids, `labels-${product.name}.pdf`);
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
            <button
              onClick={printLabels}
              title="Print barcode labels PDF"
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
                  <th className="pb-1.5 pr-3">Barcode (CODE128)</th>
                  <th className="pb-1.5 pr-3 text-right">Price</th>
                  <th className="pb-1.5 pr-3 text-right">Stock</th>
                  <th className="pb-1.5 text-right" title="Print label / Delete">
                    <Tag className="w-3 h-3 inline" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <VariantRow
                    key={v.id}
                    variant={v}
                    productName={product.name}
                    onDelete={deleteVariant}
                    onStockChange={(id, newQty) =>
                      setVariants((prev) => prev.map((x) =>
                        x.id === id ? { ...x, stock_quantity: newQty } : x
                      ))
                    }
                    canEdit={canEdit}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400 text-center py-3">No variants yet. Add your first variant below.</p>
          )}

          {canEdit && (
            showAdd
              ? <AddVariantForm
                  productId={product.id}
                  basePrice={product.base_price}
                  onAdded={(v) => setVariants((prev) => [...prev, v])}
                  onClose={() => setShowAdd(false)}
                />
              : (
                <button
                  onClick={() => setShowAdd(true)}
                  className="mt-3 flex items-center gap-1.5 text-sm text-indigo-600
                             hover:text-indigo-700 font-medium px-3 py-2 rounded-lg
                             border border-dashed border-indigo-200 hover:bg-indigo-50
                             transition-colors w-full justify-center">
                  <Plus className="w-4 h-4" /> Add Variants (Size × Color Matrix)
                </button>
              )
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
        name:         form.name,
        category:     effectiveCategory,
        description:  form.description,
        base_price:   parseFloat(form.base_price)  || 0,
        cost_price:   parseFloat(form.cost_price)  || 0,
        tax_rate:     parseFloat(form.tax_rate)    || 0,
        is_clearance: form.is_clearance,
      });
      toast.success('Product created — now add variants');
      onAdded(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create product');
    } finally { setSaving(false); }
  }

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">New Clothing Product</h3>
          <p className="text-xs text-gray-400 mt-0.5">After saving you'll add size × color variants</p>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-5 text-sm">
        {/* Product Details */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Product Details</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Product Name *</label>
            <input
              autoFocus
              className="input w-full py-1.5"
              placeholder="e.g. Classic T-Shirt, Slim Jeans, Summer Dress"
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
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rs.</span>
                <input
                  type="number" min="0" step="0.01"
                  className="input w-full text-sm py-1.5 pl-8"
                  placeholder="0.00"
                  value={form.base_price}
                  onChange={(e) => set('base_price', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cost Price</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rs.</span>
                <input
                  type="number" min="0" step="0.01"
                  className="input w-full text-sm py-1.5 pl-8"
                  placeholder="0.00"
                  value={form.cost_price}
                  onChange={(e) => set('cost_price', e.target.value)}
                />
              </div>
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
                  className="w-4 h-4 accent-red-500"
                />
                <span className="text-sm text-gray-600">Clearance / Sale</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-1.5">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5">
            {saving ? 'Saving…' : 'Create Product →'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────
export default function ClothingProductsPanel({ canEdit }) {
  const [products,     setProducts]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [category,     setCategory]     = useState('');
  const [showAdd,      setShowAdd]      = useState(false);
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
