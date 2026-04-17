import { useState } from 'react';
import { Search, RotateCcw, ArrowRight, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { clothingApi } from '../api/client';
import VariantPickerModal from '../components/VariantPickerModal';

const fmt = (n) => Number(n || 0).toFixed(2);

// Step indicator
function Steps({ current }) {
  const steps = ['Lookup','Select Returns','Choose Replacements','Confirm'];
  return (
    <div className="flex items-center gap-0 mb-6 overflow-x-auto">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
            ${current === i ? 'bg-primary-600 text-white'
              : current > i  ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-400'}`}>
            {current > i ? <CheckCircle className="w-3.5 h-3.5" /> : <span>{i+1}</span>}
            {label}
          </div>
          {i < steps.length - 1 && <ArrowRight className="w-4 h-4 text-gray-300 mx-1 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

export default function ClothingExchangesPage() {
  const [step,        setStep]       = useState(0);
  const [lookupVal,   setLookupVal]  = useState('');
  const [loading,     setLoading]    = useState(false);
  const [transaction, setTransaction] = useState(null);   // original txn + items
  const [returnSel,   setReturnSel]  = useState({});      // { itemId: qty }
  const [replacements,setReplacements] = useState({});    // { itemId: variant }
  const [variantFor,  setVariantFor] = useState(null);    // { item, variants, product }
  const [note,        setNote]       = useState('');
  const [result,      setResult]     = useState(null);    // completed exchange

  // ── Step 0: lookup ────────────────────────────────────────────
  async function doLookup() {
    if (!lookupVal.trim()) { toast.error('Enter a receipt number or phone'); return; }
    setLoading(true);
    try {
      const param = lookupVal.trim().startsWith('TXN-') || /^\d+$/.test(lookupVal.trim())
        ? { txn_number: lookupVal.trim() }
        : { phone: lookupVal.trim() };
      const { data } = await clothingApi.lookupTransaction(param);
      // data may be array (by phone) or single txn
      const txn = Array.isArray(data) ? data[0] : data;
      if (!txn) { toast.error('No transaction found'); return; }
      setTransaction(txn);
      const init = {};
      (txn.items || []).forEach((it) => { init[it.id] = 0; });
      setReturnSel(init);
      setStep(1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Not found');
    } finally { setLoading(false); }
  }

  // ── Step 1: select return items ────────────────────────────────
  function toggleItem(id, maxQty) {
    setReturnSel((p) => ({ ...p, [id]: p[id] > 0 ? 0 : maxQty }));
  }

  const selectedItems = (transaction?.items || []).filter((it) => returnSel[it.id] > 0);
  const returnTotal   = selectedItems.reduce((s, it) =>
    s + parseFloat(it.unit_price) * returnSel[it.id], 0);

  // ── Step 2: choose replacements (optional per returned item) ──
  async function openPickerFor(item) {
    if (!item.clothing_variant_id) {
      toast('This item has no clothing variant — skip replacement.');
      return;
    }
    try {
      // Load variants for the same product
      const { data } = await clothingApi.listVariants(
        item.clothing_product_id || item.product_id
      );
      setVariantFor({ item, variants: data.variants,
        product: { id: item.clothing_product_id, name: item.clothing_product_name || item.product_name } });
    } catch { toast.error('Could not load variants'); }
  }

  const issueTotal = selectedItems.reduce((s, it) => {
    const rep = replacements[it.id];
    return s + (rep ? parseFloat(rep.effective_price ?? rep.price_override ?? 0) * returnSel[it.id] : 0);
  }, 0);
  const netRefund = returnTotal - issueTotal;

  // ── Step 3: confirm & submit ─────────────────────────────────
  async function submitExchange() {
    setLoading(true);
    try {
      const returned_items = selectedItems.map((it) => ({
        variant_id:              it.clothing_variant_id,
        quantity:                returnSel[it.id],
        original_transaction_item_id: it.id,
      }));
      const issued_items = selectedItems
        .filter((it) => replacements[it.id])
        .map((it) => ({
          variant_id: replacements[it.id].id,
          quantity:   returnSel[it.id],
        }));

      const { data } = await clothingApi.processExchange({
        original_transaction_id: transaction.id,
        customer_phone:          transaction.customer_phone || '',
        returned_items,
        issued_items,
        note,
      });
      setResult(data);
      setStep(4);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Exchange failed');
    } finally { setLoading(false); }
  }

  function reset() {
    setStep(0); setLookupVal(''); setTransaction(null);
    setReturnSel({}); setReplacements({}); setNote(''); setResult(null);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Returns &amp; Exchanges</h1>

      {step < 4 && <Steps current={step} />}

      {/* ── Step 0: Lookup ── */}
      {step === 0 && (
        <div className="card p-5 space-y-4">
          <p className="text-sm text-gray-600">Enter a receipt number (e.g. TXN-2-…) or customer phone.</p>
          <div className="flex gap-2">
            <input
              autoFocus
              className="input flex-1"
              placeholder="TXN-2-20260417-123456 or 07xxxxxxxx"
              value={lookupVal}
              onChange={(e) => setLookupVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doLookup()}
            />
            <button onClick={doLookup} disabled={loading} className="btn-primary px-4 flex items-center gap-2">
              <Search className="w-4 h-4" />
              {loading ? 'Searching…' : 'Find'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Select return items ── */}
      {step === 1 && transaction && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">{transaction.transaction_number}</p>
              <p className="text-xs text-gray-400">
                {new Date(transaction.transaction_date).toLocaleDateString()}
                {transaction.customer_phone && ` · ${transaction.customer_phone}`}
              </p>
            </div>
            <button onClick={reset} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Select items to return</p>
          <ul className="divide-y divide-gray-100">
            {(transaction.items || []).map((item) => (
              <li key={item.id} className="py-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={returnSel[item.id] > 0}
                  onChange={() => toggleItem(item.id, parseFloat(item.quantity))}
                  className="w-4 h-4 accent-primary-600 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.clothing_product_name
                      ? `${item.clothing_product_name} / ${item.variant_color} / ${item.variant_size}`
                      : item.product_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    Qty: {item.quantity} · Rs. {fmt(item.unit_price)}
                  </p>
                </div>
                {returnSel[item.id] > 0 && (
                  <input
                    type="number" min="1" max={parseFloat(item.quantity)}
                    className="input w-16 text-sm py-1 text-center"
                    value={returnSel[item.id]}
                    onChange={(e) => setReturnSel((p) => ({
                      ...p, [item.id]: Math.min(parseFloat(item.quantity), parseInt(e.target.value,10) || 1)
                    }))}
                  />
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-between items-center pt-2">
            <p className="text-sm text-gray-600">
              Returning: <strong>Rs. {fmt(returnTotal)}</strong>
            </p>
            <button
              disabled={selectedItems.length === 0}
              onClick={() => setStep(2)}
              className="btn-primary"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Choose replacements ── */}
      {step === 2 && (
        <div className="card p-5 space-y-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Choose replacement items (optional)
          </p>
          <ul className="divide-y divide-gray-100">
            {selectedItems.map((item) => {
              const rep = replacements[item.id];
              return (
                <li key={item.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.clothing_product_name
                        ? `${item.clothing_product_name} / ${item.variant_color} / ${item.variant_size}`
                        : item.product_name}
                      <span className="text-gray-400 ml-1">× {returnSel[item.id]}</span>
                    </p>
                    {rep && (
                      <p className="text-xs text-primary-600 mt-0.5">
                        → {rep.color} / {rep.size}
                        {rep.effective_price && ` · Rs. ${fmt(rep.effective_price)}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => openPickerFor(item)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
                      ${rep ? 'border-primary-300 text-primary-600 bg-primary-50'
                             : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    {rep ? 'Change' : 'Select'}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between items-center pt-2">
            <div className="text-sm text-gray-600 space-y-0.5">
              <p>Returning: Rs. {fmt(returnTotal)}</p>
              <p>New items: Rs. {fmt(issueTotal)}</p>
              <p className={`font-semibold ${netRefund >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {netRefund >= 0
                  ? `Customer refund: Rs. ${fmt(netRefund)}`
                  : `Customer pays: Rs. ${fmt(-netRefund)}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
              <button onClick={() => setStep(3)} className="btn-primary">Next →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm ── */}
      {step === 3 && (
        <div className="card p-5 space-y-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Confirm exchange</p>
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
            <p className="font-semibold text-gray-700">Summary</p>
            {selectedItems.map((it) => (
              <div key={it.id} className="flex justify-between text-gray-600">
                <span className="truncate flex-1 mr-2">
                  Return: {it.clothing_product_name || it.product_name} × {returnSel[it.id]}
                  {replacements[it.id] && ` → ${replacements[it.id].color}/${replacements[it.id].size}`}
                </span>
                <span>Rs. {fmt(parseFloat(it.unit_price) * returnSel[it.id])}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-2 font-semibold text-sm
                            flex justify-between">
              <span>{netRefund >= 0 ? 'Refund to customer' : 'Charge to customer'}</span>
              <span className={netRefund >= 0 ? 'text-green-700' : 'text-red-600'}>
                Rs. {fmt(Math.abs(netRefund))}
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Note (optional)</label>
            <input
              className="input w-full text-sm"
              placeholder="e.g. Wrong size, customer preference"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
            <button onClick={submitExchange} disabled={loading}
              className="btn-primary flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              {loading ? 'Processing…' : 'Complete Exchange'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === 4 && result && (
        <div className="card p-6 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
          <h2 className="text-lg font-bold text-gray-900">Exchange Complete</h2>
          <p className="text-sm text-gray-600">
            Exchange <strong>{result.exchange_number}</strong> processed successfully.
          </p>
          {result.net_refund_amount > 0 && (
            <p className="text-sm text-green-700 font-medium">
              Refund: Rs. {fmt(result.net_refund_amount)}
            </p>
          )}
          {result.net_refund_amount < 0 && (
            <p className="text-sm text-red-600 font-medium">
              Charged: Rs. {fmt(Math.abs(result.net_refund_amount))}
            </p>
          )}
          <button onClick={reset} className="btn-primary mx-auto">New Exchange</button>
        </div>
      )}

      {/* Variant picker for replacement selection */}
      {variantFor && (
        <VariantPickerModal
          product={variantFor.product}
          variants={variantFor.variants}
          onSelect={(variant) => {
            setReplacements((p) => ({ ...p, [variantFor.item.id]: variant }));
            setVariantFor(null);
          }}
          onClose={() => setVariantFor(null)}
        />
      )}
    </div>
  );
}
