import { useMemo } from 'react';
import { X } from 'lucide-react';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const COLOR_MAP = {
  Black:  '#1f2937', White:  '#f9fafb', Red:    '#ef4444',
  Blue:   '#3b82f6', Navy:   '#1e3a8a', Grey:   '#6b7280',
  Green:  '#22c55e', Brown:  '#92400e', Yellow: '#eab308',
  Pink:   '#ec4899', Orange: '#f97316', Purple: '#a855f7',
};

function sortSizes(sizes) {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return  1;
    return a.localeCompare(b);
  });
}

function stockStatus(stock, threshold) {
  if (stock <= 0)         return 'out';
  if (stock <= threshold) return 'low';
  return 'ok';
}

/**
 * Props:
 *   product  - { id, name, base_price }
 *   variants - array from /api/clothing/products/:id/variants
 *   onSelect(variant) - called when a cell is clicked
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl
                   overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{product.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Tap a cell to add to cart &nbsp;·&nbsp; {variants.length} variant{variants.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400
                       hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-auto flex-1 p-4">
          {variants.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              No variants added yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm w-full min-w-max">
                <thead>
                  <tr>
                    {/* Corner */}
                    <th className="pb-3 pr-4 text-left align-bottom">
                      <span className="text-xs font-semibold text-gray-400">Size</span>
                      <span className="text-gray-300 mx-1">/</span>
                      <span className="text-xs font-semibold text-gray-400">Color</span>
                    </th>
                    {colors.map((color) => {
                      const hex = COLOR_MAP[color];
                      return (
                        <th key={color} className="pb-3 px-2 text-center min-w-[80px]">
                          <div className="flex flex-col items-center gap-1.5">
                            <span
                              className="w-7 h-7 rounded-full border-2 border-white shadow-md block"
                              style={{ backgroundColor: hex || '#9ca3af' }}
                            />
                            <span className="text-xs font-semibold text-gray-600">{color}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size) => (
                    <tr key={size}>
                      {/* Size label */}
                      <td className="pr-4 py-1.5 align-middle">
                        <span className="inline-block px-3 py-1.5 bg-gray-100 rounded-lg
                                         font-bold text-gray-700 text-sm min-w-[44px] text-center">
                          {size}
                        </span>
                      </td>
                      {colors.map((color) => {
                        const v      = findVariant(size, color);
                        const status = v ? stockStatus(v.stock_quantity, v.low_stock_threshold) : null;
                        const price  = v
                          ? parseFloat(v.price_override ?? v.effective_price ?? product.base_price)
                          : null;

                        if (!v) {
                          return (
                            <td key={color} className="py-1.5 px-2 text-center">
                              <div className="w-full rounded-xl border border-dashed border-gray-100 py-5" />
                            </td>
                          );
                        }

                        const disabled = status === 'out' || !v.is_active;

                        return (
                          <td key={color} className="py-1.5 px-2 text-center">
                            <button
                              disabled={disabled}
                              onClick={() => handleSelect(v)}
                              className={`w-full rounded-xl border-2 px-2 py-2.5 transition-all text-center
                                ${disabled
                                  ? 'bg-gray-50 border-gray-100 opacity-40 cursor-not-allowed'
                                  : status === 'low'
                                    ? 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:shadow-md cursor-pointer'
                                    : 'bg-white border-gray-150 hover:border-indigo-400 hover:shadow-md hover:scale-105 cursor-pointer'
                                }`}
                            >
                              {/* Stock badge */}
                              <div className={`inline-flex items-center justify-center text-[11px] font-bold
                                              px-2 py-0.5 rounded-full mb-1
                                ${disabled
                                  ? 'bg-gray-100 text-gray-400'
                                  : status === 'low'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-green-100 text-green-700'}`}>
                                {status === 'out' ? 'Out' : v.stock_quantity}
                              </div>
                              {/* Price */}
                              {price !== null && (
                                <div className="text-[11px] text-gray-500 font-medium">
                                  Rs.{price.toFixed(0)}
                                </div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          {[
            { label: 'In stock',  dot: 'bg-green-400'  },
            { label: 'Low stock', dot: 'bg-amber-400'  },
            { label: 'Out',       dot: 'bg-gray-300'   },
          ].map(({ label, dot }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
