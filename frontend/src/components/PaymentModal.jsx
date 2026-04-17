import { useState } from 'react';
import { X, Loader2, Banknote, CreditCard, SplitSquareVertical, CheckCircle2, WifiOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { transactionsApi } from '../api/client';
import { openReceipt } from '../utils/receipt';
import { queueTransaction, isOfflineAllowed } from '../utils/offlineDB';
import useAuthStore from '../store/authStore';

const METHODS = [
  { id: 'cash',   label: 'Cash',  icon: Banknote            },
  { id: 'card',   label: 'Card',  icon: CreditCard          },
  { id: 'split',  label: 'Split', icon: SplitSquareVertical },
  { id: 'mobile', label: 'Mobile', icon: CreditCard         },
];

const fmt  = (n) => Number(n || 0).toFixed(2);
const fmtN = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

// Quick-cash buttons
const CASH_PRESETS = [5, 10, 20, 50, 100];

export default function PaymentModal({ totals, items, onClose, onComplete }) {
  const user    = useAuthStore((s) => s.user);
  const isOnline = navigator.onLine;

  const [method,    setMethod]    = useState('cash');
  const [cashGiven, setCashGiven] = useState('');
  const [cardAmt,   setCardAmt]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const [done,      setDone]      = useState(null);    // { offline?: bool, server_id?, transaction_number? }

  const grand    = totals.grandTotal;
  const cashNum  = parseFloat(cashGiven) || 0;
  const cardNum  = parseFloat(cardAmt)  || 0;
  const change   = method === 'cash'  ? Math.max(0, cashNum - grand) : 0;
  const cashUsed = method === 'split' ? cashNum : grand;
  const cardUsed = method === 'split' ? Math.max(0, grand - cashNum) : 0;

  const canPay =
    (method === 'cash'   && cashNum >= grand) ||
    (method === 'card')  ||
    (method === 'mobile') ||
    (method === 'split'  && cashNum + cardNum >= grand - 0.005);

  async function handlePay() {
    setSaving(true);

    const itemsPayload = items.map((i) => ({
      product_id:          i.product_id          ?? null,
      clothing_variant_id: i.clothing_variant_id ?? null,
      quantity:            i.quantity,
      unit_price:          i.unit_price,
      discount:            i.discAmt,
    }));

    // ── Online path ──────────────────────────────────────────
    if (isOnline) {
      try {
        const { data } = await transactionsApi.create({
          payment_method:  method === 'split' ? 'cash' : method,
          discount_amount: totals.orderDiscount,
          items:           itemsPayload,
        });
        setDone({ server_id: data.id, transaction_number: data.transaction_number });
        toast.success('Payment successful!');
      } catch (err) {
        // If the API returned an offline/network error, fall through to offline path
        if (err.response?.data?.offline || !err.response) {
          await saveOffline(itemsPayload);
        } else {
          toast.error(err.response?.data?.error || 'Payment failed. Please try again.');
          setSaving(false);
        }
      }
      return;
    }

    // ── Offline path ─────────────────────────────────────────
    await saveOffline(itemsPayload);
  }

  async function saveOffline(itemsPayload) {
    // Subscription guard: block if expired > 3 days
    const allowed = await isOfflineAllowed();
    if (!allowed) {
      toast.error('Offline transactions disabled - subscription expired. Please renew.');
      setSaving(false);
      return;
    }

    try {
      const clientId = uuidv4();
      await queueTransaction({
        client_id:       clientId,
        shop_id:         user?.shop_id,
        user_id:         user?.id,
        items:           itemsPayload,
        payment_method:  method === 'split' ? 'cash' : method,
        discount_amount: totals.orderDiscount,
        total_amount:    totals.grandTotal,
        created_at:      new Date().toISOString(),
      });
      setDone({ offline: true, client_id: clientId });
      toast('Sale saved offline - will sync when connected', { icon: '📶' });
    } catch (err) {
      toast.error('Failed to save offline transaction');
      console.error(err);
      setSaving(false);
    }
  }

  function handlePrintAndClose() {
    if (done?.server_id) openReceipt(done.server_id);
    onComplete();
  }

  // ── Success screen ──────────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="card w-full max-w-sm p-6 text-center space-y-4">
          {done.offline
            ? <>
                <WifiOff className="w-16 h-16 text-yellow-400 mx-auto" />
                <h2 className="text-xl font-bold text-gray-900">Saved Offline</h2>
                <p className="text-sm text-gray-500">
                  This sale has been stored on this device and will sync automatically
                  when you reconnect to the internet.
                </p>
              </>
            : <>
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-bold text-gray-900">Sale Complete!</h2>
                <p className="text-sm text-gray-500">Txn #{done.transaction_number}</p>
              </>
          }
          {method === 'cash' && (
            <div className="bg-green-50 rounded-lg py-3 px-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Change due</p>
              <p className="text-3xl font-bold text-green-600">{fmt(change)}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={onComplete}>
              New Sale
            </button>
            {!done.offline && (
              <button className="btn-primary flex-1" onClick={handlePrintAndClose}>
                🖨 Print Receipt
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Payment</h2>
          <button className="p-1 rounded hover:bg-gray-100 text-gray-500" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Amount due */}
          <div className="text-center bg-primary-50 rounded-xl py-4">
            <p className="text-xs text-primary-500 uppercase tracking-wide mb-1">Amount Due</p>
            <p className="text-4xl font-bold text-primary-700">{fmtN(grand)}</p>
            {totals.taxAmount > 0 && (
              <p className="text-xs text-gray-400 mt-1">incl. {fmt(totals.taxAmount)} tax</p>
            )}
          </div>

          {/* Method selector */}
          <div>
            <label className="label">Payment Method</label>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border
                    text-xs font-medium transition-colors
                    ${method === id
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => setMethod(id)}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash inputs */}
          {(method === 'cash' || method === 'split') && (
            <div>
              <label className="label">Cash Received</label>
              <input
                className="input text-lg font-semibold"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                autoFocus
              />
              {/* Quick presets */}
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <button
                  className="btn-secondary text-xs py-0.5 px-2"
                  onClick={() => setCashGiven(fmt(grand))}
                >
                  Exact
                </button>
                {CASH_PRESETS.map((p) => p >= grand - 0.005 && (
                  <button
                    key={p}
                    className="btn-secondary text-xs py-0.5 px-2"
                    onClick={() => setCashGiven(String(p))}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Change */}
              {method === 'cash' && cashNum > 0 && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-center
                  ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span className="text-xs">Change: </span>
                  <span className="text-xl font-bold">{fmt(change)}</span>
                </div>
              )}
            </div>
          )}

          {/* Split: card portion */}
          {method === 'split' && (
            <div>
              <label className="label">Card Amount</label>
              <p className="text-xs text-gray-400 mb-1">
                Remaining after cash: <strong>{fmt(Math.max(0, grand - cashNum))}</strong>
              </p>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder={fmt(Math.max(0, grand - cashNum))}
                value={cardAmt}
                onChange={(e) => setCardAmt(e.target.value)}
              />
            </div>
          )}

          {/* Summary for split */}
          {method === 'split' && (cashNum > 0 || cardNum > 0) && (
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Cash</span><span>{fmt(cashUsed)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Card</span><span>{fmt(cardUsed)}</span>
              </div>
              <div className={`flex justify-between font-semibold border-t border-gray-200 pt-1
                ${cashNum + cardNum >= grand - 0.005 ? 'text-green-700' : 'text-red-600'}`}>
                <span>Total collected</span>
                <span>{fmt(cashNum + (method === 'split' ? cardNum : 0))}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn-primary flex-1 justify-center py-3 text-base"
            onClick={handlePay}
            disabled={!canPay || saving}
          >
            {saving
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
              : `Confirm Payment`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
