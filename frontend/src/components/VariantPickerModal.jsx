import { useMemo } from 'react';
import { X } from 'lucide-react';

const SIZE_ORDER = ['XS','S','M','L','XL','XXL','XXXL'];

function sortSizes(sizes) {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

// Stock status helpers
function stockStatus(stock, threshold) {
  if (stock <= 0)          return 'out';
  if (stock <= threshold)  return 'low';
  return 'ok';
}

const STATUS_CELL = {
  ok:  'bg-white border-gray-200 hover:border-primary-400 hover:shadow-sm cursor-pointer text-gray-800',
  low: 'bg-amber-50 border-amber-300 hover:border-amber-500 cursor-pointer text-amber-800',
  out: 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed text-gray-400',
};

const STATUS_BADGE = {
  ok:  'bg-green-100 text-green-700',
  low: 'bg-amber-100 text-amber-700',
  out: 'bg-gray-100 text-gray-400',
};

/**
 * Props:
 *   product  — { id, name, base_price }
 *   variants — array from /api/clothing/products/:id/variants
 *   onSelect(variant) — called when a cell is clicked
 *   onClose()
 */
export default function VariantPickerModal({ product, variants, onSelect, onClose }) {
  const sizes  = useMemo(() => sortSizes([...new Set(variants.map((v) => v.size))]),  [variants]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color))].sort(), [variants]);

  function findVariant(size, color) {
    return variants.find((v) => v.size === size && v.color === color);
  }

  function handleSelect(v) {
    if (!v || v.stock_quantity <= 0 || !v.is_active) return;
    onSelect(v);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{product.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Select size &amp; color</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400
                       hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-auto max-h-[60vh] p-4">
          {variants.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No variants added yet.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-400 pb-2 pr-3 w-16">
                    Size ↓ / Color →
                  </th>
                  {colors.map((c) => (
                    <th key={c} className="text-center text-xs font-semibold text-gray-600 pb-2 px-1">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizes.map((size) => (
                  <tr key={size}>
                    <td className="pr-3 py-1 font-semibold text-gray-700 text-xs">{size}</td>
                    {colors.map((color) => {
                      const v      = findVariant(size, color);
                      const status = v ? stockStatus(v.stock_quantity, v.low_stock_threshold) : 'out';
                      const price  = v
                        ? parseFloat(v.price_override ?? v.effective_price ?? product.base_price)
                        : null;

                      return (
                        <td key={color} className="py-1 px-1 text-center">
                          {v ? (
                            <button
                              disabled={status === 'out' || !v.is_active}
                              onClick={() => handleSelect(v)}
                              className={`w-full rounded-xl border px-2 py-2 transition-all
                                          text-[11px] font-medium ${STATUS_CELL[status]}`}
                            >
                              <div className={`inline-block text-[9px] font-bold px-1.5 py-0.5
                                              rounded-full mb-1 ${STATUS_BADGE[status]}`}>
                                {status === 'out' ? 'Out' : v.stock_quantity}
                              </div>
                              <br />
                              {price !== null && (
                                <span className="text-[10px] text-gray-500">
                                  {price.toFixed(2)}
                                </span>
                              )}
                            </button>
                          ) : (
                            <div className="w-full rounded-xl border border-dashed border-gray-200
                                            text-gray-200 text-[10px] py-3 text-center">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 bg-gray-50">
          {[
            { label: 'In stock',   cls: 'bg-green-100 text-green-700' },
            { label: 'Low stock',  cls: 'bg-amber-100 text-amber-700' },
            { label: 'Out',        cls: 'bg-gray-100 text-gray-400'   },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-3 h-3 rounded-full inline-block ${cls}`} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
