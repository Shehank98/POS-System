import { useState, useEffect } from 'react';
import {
  Search, Receipt, Printer, Ban, ChevronLeft, ChevronRight,
  RefreshCw, X, RotateCcw, TrendingDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { transactionsApi } from '../api/client';
import useAuthStore from '../store/authStore';
import { openReceipt } from '../utils/receipt';
import ConfirmDialog from '../components/ConfirmDialog';
import RefundModal from '../components/RefundModal';

const LIMIT = 30;
const fmt   = (n) => Number(n || 0).toFixed(2);
const fmtN  = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

function StatusBadge({ status }) {
  const map = {
    completed: 'badge-active',
    void:      'badge-expired',
    refunded:  'bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium',
  };
  return <span className={map[status] || 'badge-trial'}>{status}</span>;
}

function PayBadge({ method }) {
  const colors = {
    cash:   'bg-green-100 text-green-700',
    card:   'bg-blue-100 text-blue-700',
    mobile: 'bg-purple-100 text-purple-700',
    other:  'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                      capitalize ${colors[method] || colors.other}`}>
      {method}
    </span>
  );
}

export default function TransactionsPage() {
  const user       = useAuthStore((s) => s.user);
  const canVoid    = !user?.read_only && ['owner', 'manager'].includes(user?.role);
  const canRefund  = !user?.read_only && ['owner', 'manager'].includes(user?.role);

  const today = new Date().toISOString().split('T')[0];

  const [transactions, setTransactions] = useState([]);
  const [total,        setTotal]        = useState(0);
  const [summary,      setSummary]      = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [page,         setPage]         = useState(1);
  const [startDate,    setStartDate]    = useState(today);
  const [endDate,      setEndDate]      = useState(today);
  const [filterMethod, setFilterMethod] = useState('');
  const [voidId,       setVoidId]       = useState(null);
  const [refundTxn,    setRefundTxn]    = useState(null);
  const [expanded,     setExpanded]     = useState(null);
  const [expandItems,  setExpandItems]  = useState({});

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  async function load(overrides = {}) {
    setLoading(true);
    const params = {
      start_date: startDate, end_date: endDate,
      payment_method: filterMethod || undefined,
      page, limit: LIMIT,
      ...overrides,
    };
    try {
      const [listRes, sumRes] = await Promise.all([
        transactionsApi.list(params),
        transactionsApi.summary({ start_date: params.start_date, end_date: params.end_date }),
      ]);
      setTransactions(listRes.data.transactions);
      setTotal(listRes.data.total);
      setSummary(sumRes.data);
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]); // eslint-disable-line

  async function toggleExpand(txnId) {
    if (expanded === txnId) { setExpanded(null); return; }
    setExpanded(txnId);
    if (expandItems[txnId]) return;
    try {
      const { data } = await transactionsApi.get(txnId);
      setExpandItems((prev) => ({ ...prev, [txnId]: data.items }));
    } catch { /* ignore */ }
  }

  async function handleVoid() {
    try {
      await transactionsApi.void(voidId);
      toast.success('Transaction voided');
      setVoidId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Void failed');
    }
  }

  function applyFilters() { setPage(1); load({ page: 1 }); }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Transactions</h1>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Sales',   value: summary.total_transactions, cls: 'text-gray-900'    },
            { label: 'Net Revenue',   value: fmtN(summary.net_revenue),  cls: 'text-primary-700' },
            { label: 'Tax Collected', value: fmt(summary.total_tax),      cls: 'text-gray-700'   },
            { label: 'Refunds',       value: summary.refund_transactions, cls: 'text-blue-600'   },
          ].map(({ label, value, cls }) => (
            <div key={label} className="card p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${cls}`}>{value}</p>
              {label === 'Net Revenue' && Number(summary.total_refunds) > 0 && (
                <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  -{fmtN(summary.total_refunds)} refunded
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={startDate}
                   onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={endDate}
                   onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input w-32" value={filterMethod}
                    onChange={(e) => setFilterMethod(e.target.value)}>
              <option value="">All</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={applyFilters}>
              <Search className="w-4 h-4" /> Filter
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setStartDate(today); setEndDate(today);
                setFilterMethod(''); setPage(1);
                load({ page: 1, start_date: today, end_date: today, payment_method: undefined });
              }}
            >
              Today
            </button>
            <button className="btn-secondary" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Txn #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Cashier</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Method</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && transactions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading…</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No transactions found.</td></tr>
              ) : transactions.map((t) => (
                <>
                  <tr
                    key={t.id}
                    className={`hover:bg-gray-50 cursor-pointer
                      ${t.status === 'refunded' && t.refund_of ? 'bg-blue-50/30' : ''}`}
                    onClick={() => toggleExpand(t.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {t.transaction_number}
                      {t.refund_of && (
                        <span className="ml-1 text-blue-500">(refund)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell text-xs">
                      {new Date(t.transaction_date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{t.cashier || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <PayBadge method={t.payment_method} />
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold
                      ${t.refund_of ? 'text-blue-600' : ''}`}>
                      {t.refund_of && Number(t.total_amount) < 0 ? '-' : ''}
                      {fmt(Math.abs(t.total_amount))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400
                                     hover:text-primary-600"
                          title="Print receipt"
                          onClick={() => openReceipt(t.id)}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {canRefund && t.status === 'completed' && !t.refund_of && (
                          <button
                            className="p-1.5 rounded hover:bg-blue-50 text-gray-400
                                       hover:text-blue-600"
                            title="Process refund"
                            onClick={() => setRefundTxn(t)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {canVoid && t.status === 'completed' && !t.refund_of && (
                          <button
                            className="p-1.5 rounded hover:bg-red-50 text-gray-400
                                       hover:text-red-600"
                            title="Void transaction"
                            onClick={() => setVoidId(t.id)}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded line items */}
                  {expanded === t.id && (
                    <tr key={`${t.id}-items`} className="bg-blue-50/40">
                      <td colSpan={7} className="px-8 py-3">
                        {expandItems[t.id] ? (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left pb-1">Product</th>
                                <th className="text-right pb-1">Qty</th>
                                <th className="text-right pb-1">Unit</th>
                                <th className="text-right pb-1">Discount</th>
                                <th className="text-right pb-1">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {expandItems[t.id].map((i) => (
                                <tr key={i.id}>
                                  <td className="py-0.5">{i.product_name || 'Deleted product'}</td>
                                  <td className="text-right">{i.quantity}</td>
                                  <td className="text-right">{fmt(i.unit_price)}</td>
                                  <td className="text-right text-orange-500">
                                    {Number(i.discount) > 0 ? `-${fmt(i.discount)}` : '-'}
                                  </td>
                                  <td className="text-right font-medium">{fmt(i.subtotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <span className="text-gray-400">Loading items…</span>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-sm text-gray-500">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button className="btn-secondary px-2 py-1"
                      onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="btn-secondary px-2 py-1"
                      onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {voidId && (
        <ConfirmDialog
          message="Void this transaction? Stock will be restored. This cannot be undone."
          onConfirm={handleVoid}
          onCancel={() => setVoidId(null)}
        />
      )}

      {refundTxn && (
        <RefundModal
          transaction={refundTxn}
          onClose={() => setRefundTxn(null)}
          onDone={() => { setRefundTxn(null); load(); }}
        />
      )}
    </div>
  );
}
