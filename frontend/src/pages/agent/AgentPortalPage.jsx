import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Store, CreditCard, Wallet, LogOut,
  TrendingUp, Users, Clock, Lock, Plus, ChevronDown,
  CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agentApi } from '../../api/client';
import useAgentStore from '../../store/agentStore';

// ── Helpers ────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2 });
function fmtMoney(v) { return `LKR ${fmt.format(Number(v) || 0)}`; }
function fmtDate(d)  { return d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'; }

function statusChip(status) {
  const map = {
    active:               'bg-green-100 text-green-800',
    trial:                'bg-blue-100 text-blue-800',
    expired:              'bg-red-100 text-red-800',
    suspended:            'bg-gray-100 text-gray-600',
    pending_verification: 'bg-yellow-100 text-yellow-800',
    verified:             'bg-green-100 text-green-800',
    rejected:             'bg-red-100 text-red-800',
    pending:              'bg-yellow-100 text-yellow-800',
    approved:             'bg-green-100 text-green-800',
    paid:                 'bg-blue-100 text-blue-800',
    locked:               'bg-gray-100 text-gray-600',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

function StatusBadge({ status, label }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusChip(status)}`}>
      {label || status?.replace('_', ' ')}
    </span>
  );
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color = 'green' }) {
  const colors = {
    green:  { bg: 'bg-green-50',  icon: 'text-green-700',  val: 'text-green-800' },
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-700',   val: 'text-blue-800' },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-700', val: 'text-yellow-800' },
    gray:   { bg: 'bg-gray-50',   icon: 'text-gray-600',   val: 'text-gray-700' },
  };
  const c = colors[color] || colors.green;
  return (
    <div className={`${c.bg} rounded-xl p-4 border border-white`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${c.icon}`} />
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`text-lg font-bold ${c.val} truncate`}>{value}</p>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────
function DashboardTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await agentApi.dashboard();
      setData(d);
    } catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (!data)   return <Empty text="No dashboard data" />;

  const targetPct = data.monthly_target > 0
    ? Math.min((data.active_customers / data.monthly_target) * 100, 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Shops"   value={data.total_customers}  icon={Store}      color="green" />
        <StatCard label="Active Shops"  value={data.active_customers} icon={CheckCircle} color="blue" />
        <StatCard label="Approved Earn" value={fmtMoney(data.approved_earnings)} icon={Wallet}  color="green" />
        <StatCard label="Pending Earn"  value={fmtMoney(data.pending_earnings)}  icon={Lock}    color="yellow" />
      </div>

      {/* Monthly target */}
      {data.monthly_target > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Monthly Target</span>
            <span className="text-sm text-gray-500">
              {data.active_customers} / {data.monthly_target} active shops
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-2 bg-green-600 rounded-full transition-all"
              style={{ width: `${targetPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{targetPct.toFixed(0)}% of target reached</p>
        </div>
      )}

      {/* Pending submissions alert */}
      {data.pending_submissions > 0 && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            <strong>{data.pending_submissions}</strong> payment submission(s) awaiting admin verification
          </p>
        </div>
      )}

      {/* Expiring soon */}
      {data.expiring_soon?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Expiring Soon (within 3 days)
          </h3>
          <div className="space-y-2">
            {data.expiring_soon.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">{s.name}</span>
                <span className="text-red-600">{fmtDate(s.subscription_end_date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shops Tab ─────────────────────────────────────────────────
function ShopsTab() {
  const [shops, setShops]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]       = useState({ name:'', owner_name:'', email:'', phone:'', address:'' });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await agentApi.customers();
      setShops(Array.isArray(data) ? data : data.customers || []);
    } catch { toast.error('Failed to load shops'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = shops.filter((s) =>
    !query ||
    s.name?.toLowerCase().includes(query.toLowerCase()) ||
    s.owner_name?.toLowerCase().includes(query.toLowerCase()) ||
    s.email?.toLowerCase().includes(query.toLowerCase())
  );

  async function handleOnboard(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await agentApi.onboard({
        ...form,
        phone:   form.phone   || undefined,
        address: form.address || undefined,
      });
      toast.success('Shop onboarded successfully!');
      setShowForm(false);
      setForm({ name:'', owner_name:'', email:'', phone:'', address:'' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to onboard shop');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {/* Search + Onboard */}
      <div className="flex gap-3">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Search shops…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800"
        >
          <Plus className="w-4 h-4" /> Onboard
        </button>
      </div>

      {/* Onboard form */}
      {showForm && (
        <form onSubmit={handleOnboard} className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-green-800 text-sm">Onboard New Shop</h3>
          {[
            { key:'name',       label:'Shop Name *',  type:'text',  required:true },
            { key:'owner_name', label:'Owner Name *', type:'text',  required:true },
            { key:'email',      label:'Email *',      type:'email', required:true },
            { key:'phone',      label:'Phone',        type:'tel',   required:false },
            { key:'address',    label:'Address',      type:'text',  required:false },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input
                type={f.type}
                required={f.required}
                value={form[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Onboard Shop'}
            </button>
          </div>
        </form>
      )}

      {/* Shop list */}
      {filtered.length === 0
        ? <Empty text={query ? `No results for "${query}"` : 'No shops yet'} />
        : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                    <p className="text-sm text-gray-500">{s.owner_name}</p>
                    <p className="text-xs text-gray-400">{s.email}</p>
                  </div>
                  <StatusBadge status={s.subscription_status} />
                </div>
                {s.subscription_end_date && (
                  <p className="text-xs text-gray-400 mt-2">
                    Expires: {fmtDate(s.subscription_end_date)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ── Payments Tab ──────────────────────────────────────────────
function PaymentsTab() {
  const [payments, setPayments]   = useState([]);
  const [shops, setShops]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ shop_id:'', amount:'', payment_date:todayStr(), notes:'' });
  const [saving, setSaving]       = useState(false);

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: p }, { data: c }] = await Promise.all([agentApi.payments(), agentApi.customers()]);
      setPayments(Array.isArray(p) ? p : p.payments || []);
      setShops(Array.isArray(c) ? c : c.customers || []);
    } catch { toast.error('Failed to load payments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!form.shop_id || !amt || amt <= 0) { toast.error('Select a shop and enter a valid amount'); return; }
    setSaving(true);
    try {
      await agentApi.submitPayment({
        shop_id:        parseInt(form.shop_id),
        amount:         amt,
        payment_method: 'cash',
        payment_date:   form.payment_date,
        notes:          form.notes || undefined,
      });
      toast.success('Payment submitted — awaiting admin verification');
      setShowForm(false);
      setForm({ shop_id:'', amount:'', payment_date:todayStr(), notes:'' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit payment');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  const payStatusLabel = { pending_verification:'Pending', verified:'Verified', rejected:'Rejected' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 text-sm">Payment Submissions</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800"
        >
          <Plus className="w-4 h-4" /> Submit Payment
        </button>
      </div>

      {/* Submit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-yellow-800 text-sm">Submit Cash Payment</h3>
          <p className="text-xs text-yellow-700">Payment will remain PENDING until admin verifies it.</p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Select Shop *</label>
            <select
              required
              value={form.shop_id}
              onChange={(e) => setForm((p) => ({ ...p, shop_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">— Choose shop —</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (LKR) *</label>
            <input
              type="number" min="1" step="0.01" required
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date *</label>
            <input
              type="date" required
              max={todayStr()}
              value={form.payment_date}
              onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit'}
            </button>
          </div>
        </form>
      )}

      {/* Payments list */}
      {payments.length === 0
        ? <Empty text="No payment submissions yet" />
        : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{p.shop_name}</p>
                    <p className="text-sm font-bold text-green-700 mt-0.5">{fmtMoney(p.amount)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.payment_method?.toUpperCase()} · {fmtDate(p.payment_date)}
                    </p>
                  </div>
                  <StatusBadge
                    status={p.status}
                    label={payStatusLabel[p.status] || p.status}
                  />
                </div>
                {p.admin_note && (
                  <p className="text-xs text-red-600 mt-2 border-t border-red-100 pt-2">
                    Admin note: {p.admin_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ── Commissions Tab ───────────────────────────────────────────
function CommissionsTab() {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await agentApi.commissions();
      setList(Array.isArray(data) ? data : data.commissions || []);
    } catch { toast.error('Failed to load commissions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  const approved = list.filter((c) => c.status === 'approved');
  const locked   = list.filter((c) => c.status === 'locked');
  const paid     = list.filter((c) => c.status === 'paid');

  const totalApproved = approved.reduce((s, c) => s + Number(c.amount), 0);
  const totalPaid     = paid.reduce((s, c) => s + Number(c.amount), 0);
  const totalLocked   = locked.reduce((s, c) => s + Number(c.amount), 0);

  function CommSection({ title, items, color }) {
    if (!items.length) return null;
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-600 mb-2">{title}</h4>
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{c.shop_name}</p>
                <p className="text-xs text-gray-400 capitalize">
                  {c.commission_type}
                  {c.month ? ` · ${new Date(c.month).toLocaleDateString('en-GB', { month:'short', year:'numeric' })}` : ''}
                </p>
              </div>
              <p className={`font-bold text-sm ${color}`}>{fmtMoney(c.amount)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Approved"    value={fmtMoney(totalApproved)} icon={CheckCircle} color="green" />
        <StatCard label="Paid Out"    value={fmtMoney(totalPaid)}     icon={Wallet}      color="blue" />
        <StatCard label="Locked"      value={fmtMoney(totalLocked)}   icon={Lock}        color="yellow" />
      </div>

      {list.length === 0
        ? <Empty text="No commissions yet" />
        : (
          <>
            <CommSection title="Approved" items={approved} color="text-green-700" />
            <CommSection title="Locked (awaiting verification)" items={locked} color="text-yellow-700" />
            <CommSection title="Paid" items={paid} color="text-blue-700" />
          </>
        )
      }
    </div>
  );
}

// ── Shared micro-components ────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
    </div>
  );
}
function Empty({ text }) {
  return <p className="text-center text-gray-400 py-16 text-sm">{text}</p>;
}

// ── Tabs config ───────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard, component: DashboardTab },
  { id: 'shops',       label: 'Shops',       icon: Store,           component: ShopsTab },
  { id: 'payments',    label: 'Payments',    icon: CreditCard,      component: PaymentsTab },
  { id: 'commissions', label: 'Commissions', icon: Wallet,          component: CommissionsTab },
];

// ── Main Portal ───────────────────────────────────────────────
export default function AgentPortalPage() {
  const { agent, logout } = useAgentStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component || DashboardTab;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-800 to-green-700 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-lg leading-tight">{agent?.name || 'Agent Portal'}</p>
            {agent?.district && (
              <p className="text-green-200 text-xs">{agent.district}</p>
            )}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-green-200 hover:text-white text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto pb-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'border-white text-white'
                  : 'border-transparent text-green-200 hover:text-white'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <ActiveComponent />
      </main>
    </div>
  );
}
