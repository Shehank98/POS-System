import { useState, useEffect } from 'react';
import { X, RotateCcw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { transactionsApi } from '../api/client';

const fmt = (n) => Number(n || 0).toFixed(2);

export default function RefundModal({ transaction, onClose, onDone }) {
  const [items,      setItems]      = useState([]);
  const [selected,   setSelected]   = useState({});   // item_id → qty to refund
  const [reason,     setReason]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(null);

  useEffect(() => {
    transactionsApi.get(transaction.id)
      .then(({ data }) => {
        setItems(data.items || []);
        // default: select all items at full qty
        const sel = {};
        (data.items || []).forEach((i) => { sel[i.id] = parseFloat(i.quantity); });
        setSelected(sel);
      })
      .catch(() => toast.error('Failed to load transaction items'))
      .finally(() => setLoading(false));
  }, [transaction.id]);

  function toggle(id, checked, qty) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) {
        next[id] = qty;
      } else {
        delete next[id];
      }
      return next;
    });
  }

  function setQty(id, val) {
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) {
      setSelected((prev) => ({ ...prev, [id]: n }));
    }
  }

  const refundItems = items
    .filter((i) => selected[i.id] !== undefined)
    .map((i) => {
      const ratio = selected[i.id] / parseFloat(i.quantity);
      return {
        transaction_item_id: i.id,
        quantity: selected[i.id],
        refund_amount: parseFloat(i.subtotal) * ratio,
      };
    });

  const totalRefund = refundItems.reduce((s, i) => s + i.refund_amount, 0);

  async function handleSubmit() {
    if (refundItems.length === 0) {
      toast.error('Select at least one item to refund');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        items:  refundItems.map(({ transaction_item_id, quantity }) => ({
          transaction_item_id, quantity,
        })),
        reason,
      };
      const { data } = await transactionsApi.refund(transaction.id, payload);
      setDone(data);
      toast.success('Refund processed successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Refund failed');
      setSubmitting(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="card w-full max-w-sm p-6 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Refund Processed</h2>
          <p className="text-sm text-gray-500">Refund #{done.transaction_number}</p>
          <div className="bg-blue-50 rounded-lg py-3 px-4">
            <p className="text-xs text-gray-500 mb-1">Amount refunded</p>
            <p className="text-2xl font-bold text-blue-700">{fmt(Math.abs(done.total_amount))}</p>
          </div>
          <p className="text-xs text-gray-400">Stock has been restored for returned items.</p>
          <button className="btn-primary w-full justify-center" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-blue-600" /> Process Refund
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Txn #{transaction.transaction_number}</p>
          </div>
          <button className="p-1 rounded hover:bg-gray-100 text-gray-500" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Select items to return. Stock will be restored for selected items.
                </p>
              </div>

              {/* Item selection */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Select Items to Return
                </p>
                {items.map((item) => {
                  const isSelected = selected[item.id] !== undefined;
                  const maxQty = parseFloat(item.quantity);
                  const refundQty = selected[item.id] || maxQty;
                  const refundAmt = parseFloat(item.subtotal) * (refundQty / maxQty);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
                        ${isSelected ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-primary-600 shrink-0"
                        checked={isSelected}
                        onChange={(e) => toggle(item.id, e.target.checked, maxQty)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.product_name || 'Deleted product'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {fmt(item.unit_price)} × {maxQty} = {fmt(item.subtotal)}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-xs text-gray-500">Qty:</label>
                          <input
                            className="w-16 text-sm text-center border border-gray-200 rounded px-1 py-0.5"
                            type="number"
                            min="0.01"
                            max={maxQty}
                            step="1"
                            value={refundQty}
                            onChange={(e) => setQty(item.id, e.target.value)}
                          />
                          <span className="text-sm font-medium text-blue-700 w-16 text-right">
                            {fmt(refundAmt)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reason */}
              <div>
                <label className="label">Reason for Return</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="e.g. Damaged item, wrong order…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="px-6 pb-5 pt-3 border-t border-gray-100 shrink-0 space-y-3">
            {totalRefund > 0 && (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-2">
                <span className="text-sm text-gray-600">Total Refund</span>
                <span className="text-lg font-bold text-blue-700">{fmt(totalRefund)}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                className="btn-primary flex-1 justify-center bg-blue-600 hover:bg-blue-700"
                onClick={handleSubmit}
                disabled={submitting || refundItems.length === 0}
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                  : <><RotateCcw className="w-4 h-4" /> Process Refund</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
