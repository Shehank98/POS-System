import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, Car, Plus, Trash2, Loader2,
  CheckCircle2, PlayCircle, DollarSign, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { carwashApi, authApi } from '../../api/client';
import useAuthStore from '../../store/authStore';

const STATUS_FLOW = {
  waiting:     { next: 'in_progress', label: 'Start Job',     cls: 'bg-blue-600 hover:bg-blue-700'   },
  in_progress: { next: 'completed',   label: 'Mark Complete', cls: 'bg-green-600 hover:bg-green-700' },
  completed:   { next: null,          label: 'Completed',     cls: 'bg-gray-300'                     },
  paid:        { next: null,          label: 'Paid',          cls: 'bg-gray-300'                     },
};

const STATUS_BADGE = {
  waiting:     'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100  text-blue-700',
  completed:   'bg-green-100 text-green-700',
  paid:        'bg-gray-100  text-gray-600',
};

function AddItemModal({ onClose, onAdd, services, products }) {
  const [tab,      setTab]      = useState('service');
  const [itemId,   setItemId]   = useState('');
  const [qty,      setQty]      = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const list = tab === 'service' ? services : products;
  const selected = list.find((i) => String(i.id) === String(itemId));

  async function handleAdd() {
    if (!selected) return;
    setSubmitting(true);
    await onAdd({
      item_type:  tab,
      item_id:    selected.id,
      item_name:  selected.name,
      quantity:   qty,
      unit_price: parseFloat(selected.price),
    });
    setSubmitting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
        <h2 className="font-bold text-gray-900">Add Item</h2>

        {/* Tabs */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {['service', 'product'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setItemId(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors
                          ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t === 'service' ? 'Service' : 'Product'}
            </button>
          ))}
        </div>

        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">- Select {tab} -</option>
          {list.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} - Rs. {parseFloat(i.price).toFixed(2)}
              {tab === 'product' ? ` (${i.stock_quantity} in stock)` : ''}
            </option>
          ))}
        </select>

        {tab === 'product' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
            <input
              type="number" min="1" value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {selected && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            Subtotal: <strong>Rs. {(parseFloat(selected.price) * qty).toFixed(2)}</strong>
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selected || submitting}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                       rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function PayModal({ totalDue, onClose, onPay }) {
  const [amount,  setAmount]  = useState(totalDue.toFixed(2));
  const [method,  setMethod]  = useState('cash');
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    await onPay(parseFloat(amount), method);
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
        <h2 className="font-bold text-gray-900">Collect Payment</h2>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount</label>
          <input
            type="number" step="0.01" min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {['cash', 'card', 'digital'].map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors
                            ${method === m
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={loading || !amount}
            className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50
                       rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CarWashJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user    = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'staff';

  const [job,       setJob]       = useState(null);
  const [services,  setServices]  = useState([]);
  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [showPay,   setShowPay]   = useState(false);
  const [staffList, setStaffList] = useState([]);

  function loadJob() {
    return carwashApi.getJob(id).then((r) => setJob(r.data));
  }

  useEffect(() => {
    Promise.all([
      loadJob(),
      carwashApi.listServices(),
      carwashApi.listProducts({ include_inactive: 'true' }),
      authApi.listUsers(),
    ]).then(([, s, p, u]) => {
      setServices(s.data);
      setProducts(p.data);
      setStaffList(u.data);
    }).catch(() => toast.error('Failed to load job'))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  async function handleStatusChange(nextStatus) {
    try {
      const { data } = await carwashApi.updateJobStatus(id, nextStatus);
      setJob((j) => ({ ...j, status: data.status, updated_at: data.updated_at }));
      toast.success(`Job is now ${data.status.replace('_', ' ')}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }

  async function handleAddItem(itemData) {
    try {
      await carwashApi.addJobItem(id, itemData);
      await loadJob();
      toast.success('Item added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add item');
    }
  }

  async function handleRemoveItem(itemId) {
    try {
      await carwashApi.removeJobItem(id, itemId);
      setJob((j) => ({ ...j, items: j.items.filter((i) => i.id !== itemId) }));
      toast.success('Item removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove item');
    }
  }

  async function handlePay(amount, method) {
    try {
      await carwashApi.payJob(id, { amount, payment_method: method });
      await loadJob();
      toast.success('Payment recorded!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment failed');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!job) return <p className="text-center text-gray-400 py-12">Job not found.</p>;

  const totalAmount = (job.items || []).reduce((s, i) => s + parseFloat(i.subtotal), 0);
  const totalPaid   = (job.payments || []).reduce((s, p) => s + parseFloat(p.amount), 0);
  const totalDue    = Math.max(0, totalAmount - totalPaid);
  const flow        = STATUS_FLOW[job.status];
  const badgeCls    = STATUS_BADGE[job.status] || 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">
              {job.vehicle_number || 'No plate'}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeCls}`}>
              {job.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate">
            {job.customer_name || job.phone_number || 'Unknown customer'}
            {job.vehicle_type && ` · ${job.vehicle_type}`}
          </p>
        </div>
      </div>

      {/* Status action buttons */}
      {job.status !== 'paid' && (
        <div className="flex gap-2">
          {flow?.next && (
            <button
              onClick={() => handleStatusChange(flow.next)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                          text-sm font-semibold text-white transition-colors ${flow.cls}`}
            >
              {flow.next === 'in_progress' ? <PlayCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {flow.label}
            </button>
          )}
          {job.status === 'completed' && !isStaff && (
            <button
              onClick={() => setShowPay(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                         text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              <DollarSign className="w-4 h-4" /> Collect Payment
            </button>
          )}
        </div>
      )}

      {/* Job info */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 text-sm">
        {job.staff_name && (
          <div className="flex justify-between text-gray-600">
            <span>Assigned to</span><strong>{job.staff_name}</strong>
          </div>
        )}
        <div className="flex justify-between text-gray-600">
          <span>Created</span>
          <span>{job.created_at ? new Date(job.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
        </div>
        {job.notes && (
          <div className="pt-1 border-t border-gray-100 text-gray-500 italic">
            "{job.notes}"
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 text-sm">Items</h2>
          {job.status !== 'paid' && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
        </div>

        {(!job.items || job.items.length === 0) ? (
          <p className="text-xs text-gray-400 py-2">No items added yet.</p>
        ) : (
          <div className="space-y-1.5">
            {job.items.map((item) => (
              <div key={item.id}
                className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.item_name}</p>
                  <p className="text-xs text-gray-400">
                    {item.item_type} · ×{parseFloat(item.quantity)}
                    {item.added_by_name && ` · by ${item.added_by_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    Rs. {parseFloat(item.subtotal).toFixed(2)}
                  </span>
                  {job.status !== 'paid' && (
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Totals - hidden from staff */}
        {!isStaff && (
          <div className="pt-2 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-sm font-bold text-gray-900">
              <span>Total</span>
              <span>Rs. {totalAmount.toFixed(2)}</span>
            </div>
            {totalPaid > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Paid</span>
                <span>Rs. {totalPaid.toFixed(2)}</span>
              </div>
            )}
            {totalDue > 0 && (
              <div className="flex justify-between text-sm font-semibold text-red-600">
                <span>Balance Due</span>
                <span>Rs. {totalDue.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment history - hidden from staff */}
      {!isStaff && job.payments && job.payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
          <h2 className="font-semibold text-gray-700 text-sm">Payments</h2>
          {job.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-sm text-gray-600">
              <span className="capitalize">{p.payment_method}</span>
              <div className="text-right">
                <span className="font-semibold text-gray-900">Rs. {parseFloat(p.amount).toFixed(2)}</span>
                <span className="block text-xs text-gray-400">
                  {p.paid_at ? new Date(p.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddItemModal
          services={services}
          products={products}
          onClose={() => setShowAdd(false)}
          onAdd={handleAddItem}
        />
      )}
      {showPay && (
        <PayModal
          totalDue={totalDue}
          onClose={() => setShowPay(false)}
          onPay={handlePay}
        />
      )}
    </div>
  );
}
