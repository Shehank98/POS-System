import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, Store, CreditCard, Wallet, LogOut,
  TrendingUp, Users, Clock, Lock, Plus, ChevronDown,
  CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw,
  User, Building2, Save, Bell, PhoneCall, CalendarClock,
  MapPin, QrCode, Upload, Eye, Copy, FileText, Download,
  Settings,
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
    pending_payment:      'bg-orange-100 text-orange-800',
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

// ── Onboard wizard (4 steps) ──────────────────────────────────
const BLANK_FORM = { name:'', owner_name:'', email:'', phone:'', address:'', shop_type:'retail', username:'', password:'', plan_id:'', subscription_months:1 };

const SHOP_TYPES = [
  { value: 'retail',      label: 'Retail Store'        },
  { value: 'clothing',    label: 'Clothing Store'       },
  { value: 'grocery',     label: 'Grocery / Supermarket'},
  { value: 'pharmacy',    label: 'Pharmacy'             },
  { value: 'car_wash',    label: 'Car Wash'             },
  { value: 'restaurant',  label: 'Restaurant / Cafe'    },
  { value: 'salon',       label: 'Salon / Spa'          },
  { value: 'electronics', label: 'Electronics'          },
  { value: 'other',       label: 'Other'                },
];

function OnboardWizard({ onDone, onClose }) {
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState(BLANK_FORM);
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    agentApi.plans().then(({ data }) => setPlans(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const MONTH_OPTS = [
    { v:1,  label:'1 Month' },
    { v:3,  label:'3 Months (-10%)' },
    { v:6,  label:'6 Months (-15%)' },
    { v:12, label:'1 Year (-20%)' },
  ];

  function calcPrice(plan, months) {
    if (!plan) return null;
    let disc = 0;
    if (months >= 12) disc = parseFloat(plan.discount_12m);
    else if (months >= 6) disc = parseFloat(plan.discount_6m);
    else if (months >= 3) disc = parseFloat(plan.discount_3m);
    return (parseFloat(plan.base_monthly_price) * months * (1 - disc)).toFixed(2);
  }

  const selectedPlan = plans.find((p) => String(p.id) === String(form.plan_id));
  const totalPrice   = calcPrice(selectedPlan, form.subscription_months);

  const STEPS = ['Shop Info', 'Login Account', 'Subscription', 'Review'];

  async function handleSubmit() {
    setSaving(true);
    try {
      await agentApi.onboard({
        name:               form.name,
        owner_name:         form.owner_name,
        email:              form.email,
        phone:              form.phone   || undefined,
        address:            form.address || undefined,
        shop_type:          form.shop_type || 'retail',
        username:           form.username,
        password:           form.password,
        plan_id:            form.plan_id || undefined,
        subscription_months: Number(form.subscription_months),
      });
      toast.success('Shop onboarded! Awaiting payment.');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to onboard shop');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-green-200 rounded-xl overflow-hidden">
      {/* Step indicator */}
      <div className="flex border-b border-gray-100">
        {STEPS.map((label, i) => (
          <div key={i} className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${
            i + 1 === step ? 'bg-green-700 text-white' :
            i + 1 < step  ? 'bg-green-100 text-green-700' :
                             'text-gray-400'
          }`}>
            <span className="inline-flex items-center gap-1">
              <span className={`w-4 h-4 rounded-full text-[10px] inline-flex items-center justify-center font-bold ${
                i + 1 < step ? 'bg-green-600 text-white' : i + 1 === step ? 'bg-white text-green-700' : 'bg-gray-200 text-gray-500'
              }`}>{i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* Step 1 — Shop Info */}
        {step === 1 && (
          <>
            <h3 className="font-semibold text-green-800 text-sm">Shop Information</h3>
            {[
              { key:'name',       label:'Shop Name *',  type:'text',  required:true },
              { key:'owner_name', label:'Owner Name *', type:'text',  required:true },
              { key:'email',      label:'Email *',      type:'email', required:true },
              { key:'phone',      label:'Phone',        type:'tel',   required:false },
              { key:'address',    label:'Address',      type:'text',  required:false },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                <input type={f.type} value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Shop Type *</label>
              <select
                value={form.shop_type}
                onChange={(e) => set('shop_type', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {SHOP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Step 2 — Login account */}
        {step === 2 && (
          <>
            <h3 className="font-semibold text-green-800 text-sm">Owner Login Account</h3>
            <p className="text-xs text-gray-500">The shop owner will use these credentials to log into the POS system.</p>
            {[
              { key:'username', label:'Username *',                       type:'text',     required:true },
              { key:'password', label:'Password * (min 6 characters)',    type:'password', required:true },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                <input type={f.type} value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            ))}
          </>
        )}

        {/* Step 3 — Subscription plan */}
        {step === 3 && (
          <>
            <h3 className="font-semibold text-green-800 text-sm">Subscription Plan</h3>
            {plans.length === 0
              ? <p className="text-xs text-gray-400">No plans available — shop will be created without a plan.</p>
              : (
                <div className="space-y-2">
                  {plans.map((p) => (
                    <label key={p.id} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      String(form.plan_id) === String(p.id)
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-green-300'
                    }`}>
                      <input type="radio" name="plan" value={p.id}
                        checked={String(form.plan_id) === String(p.id)}
                        onChange={() => set('plan_id', p.id)}
                        className="mt-0.5 accent-green-700" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-gray-800">{p.name}</span>
                          <span className="text-sm font-bold text-green-700">LKR {Number(p.base_monthly_price).toLocaleString()}/mo</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )
            }
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subscription Duration</label>
              <div className="grid grid-cols-2 gap-2">
                {MONTH_OPTS.map((o) => (
                  <button key={o.v} type="button"
                    onClick={() => set('subscription_months', o.v)}
                    className={`py-2 text-xs rounded-lg border font-medium transition-colors ${
                      form.subscription_months === o.v
                        ? 'bg-green-700 text-white border-green-700'
                        : 'border-gray-300 text-gray-600 hover:border-green-400'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {totalPrice && (
              <div className="bg-green-50 rounded-lg p-3 text-sm">
                <span className="text-gray-600">Expected payment: </span>
                <span className="font-bold text-green-800">LKR {Number(totalPrice).toLocaleString()}</span>
              </div>
            )}
          </>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <>
            <h3 className="font-semibold text-green-800 text-sm">Review & Confirm</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Shop Name',    form.name],
                ['Owner',        form.owner_name],
                ['Email',        form.email],
                ['Phone',        form.phone || '—'],
                ['Shop Type',    SHOP_TYPES.find((t) => t.value === form.shop_type)?.label || form.shop_type],
                ['Username',     form.username],
                ['Plan',         selectedPlan?.name || '— (no plan)'],
                ['Duration',     `${form.subscription_months} month(s)`],
                ['Expected Amt', totalPrice ? `LKR ${Number(totalPrice).toLocaleString()}` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-gray-500 shrink-0">{k}</span>
                  <span className="font-medium text-gray-800 text-right truncate">{v}</span>
                </div>
              ))}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
              Shop will be created as <strong>Pending Payment</strong>. Agent must submit cash payment after collecting from owner.
            </div>
          </>
        )}

        {/* Nav buttons */}
        <div className="flex gap-2 pt-1">
          {step > 1
            ? <button type="button" onClick={() => setStep((s) => s - 1)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                Back
              </button>
            : <button type="button" onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
          }
          {step < 4
            ? <button type="button"
                disabled={
                  (step === 1 && (!form.name || !form.owner_name || !form.email)) ||
                  (step === 2 && (!form.username || form.password.length < 6))
                }
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50">
                Next
              </button>
            : <button type="button" disabled={saving} onClick={handleSubmit}
                className="flex-1 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Onboard Shop'}
              </button>
          }
        </div>
      </div>
    </div>
  );
}

// ── Shop QR Modal ─────────────────────────────────────────────
function ShopQRModal({ shop, onClose }) {
  const [qr,       setQr]       = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [proofId,  setProofId]  = useState(null);
  const [reference, setRef]     = useState('');

  useEffect(() => {
    agentApi.generateShopQR(shop.id)
      .then(({ data }) => {
        setQr(data.qr_data_url);
        setRef(data.reference);
        setProofId(data.proof_id);
      })
      .catch(() => toast.error('Failed to generate QR code'))
      .finally(() => setLoading(false));
  }, [shop.id]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <h3 className="font-bold text-gray-900 mb-1">HelaPay QR – {shop.name}</h3>
        <p className="text-xs text-gray-500 mb-4">
          Ref: <span className="font-mono font-semibold">{shop.shop_reference_id}</span> · LKR 2,500.00
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          </div>
        ) : qr ? (
          <div className="text-center">
            <img src={qr} alt="Payment QR" className="mx-auto w-56 h-56 border rounded-xl p-2" />
            <p className="text-xs text-gray-400 mt-2 font-mono break-all">{reference}</p>
            <p className="text-xs text-green-700 mt-2 font-medium">
              QR recorded — admin can verify payment once scanned
            </p>
          </div>
        ) : (
          <p className="text-sm text-red-500 text-center py-6">Failed to generate QR</p>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Shop Registration Form ────────────────────────────────────
function ShopRegisterForm({ onDone, onClose }) {
  const [form, setForm] = useState({
    shop_name: '', owner_name: '', contact_number: '',
    location_lat: '', location_lng: '', location_map_url: '',
    br_number: '',
    email: '', username: '', password: '',
    shop_type: 'retail',
  });
  const [saving, setSaving]   = useState(false);
  const [result, setResult]   = useState(null);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const fc  = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.shop_name || !form.owner_name || !form.contact_number) {
      toast.error('Shop Name, Owner Name and Contact Number are required');
      return;
    }
    if (!form.email || !form.username || !form.password) {
      toast.error('Shop login credentials are required');
      return;
    }
    setSaving(true);
    try {
      const { data } = await agentApi.registerShop({
        ...form,
        location_lat: form.location_lat ? parseFloat(form.location_lat) : undefined,
        location_lng: form.location_lng ? parseFloat(form.location_lng) : undefined,
      });
      setResult(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register shop');
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  }

  if (result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <h3 className="font-bold text-green-800">Shop Registered!</h3>
        </div>
        <p className="text-sm text-green-700">
          Share these credentials with the shop owner. They can log in at{' '}
          <strong>{window.location.origin}/login</strong>
        </p>

        <div className="bg-white rounded-xl border border-green-200 p-4 space-y-3">
          <InfoRow label="Shop Reference" value={result.shop_reference_id} onCopy={() => copyToClipboard(result.shop_reference_id)} />
          <InfoRow label="Shop Name"      value={result.name} />
          <InfoRow label="Login Email"    value={result.email}               onCopy={() => copyToClipboard(result.email)} />
          <InfoRow label="Username"       value={result.generated_username}  onCopy={() => copyToClipboard(result.generated_username)} />
          <InfoRow label="Password"       value={result.generated_password}  onCopy={() => copyToClipboard(result.generated_password)} />
          <p className="text-xs text-orange-600 font-medium">
            Account is INACTIVE until payment of LKR 2,500 is verified by admin.
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Close</button>
          <button onClick={onDone} className="flex-1 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800">
            Register Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-bold text-gray-800">Register New Shop</h3>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Shop Info</legend>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Shop Name *</label>
          <input value={form.shop_name} onChange={set('shop_name')} required className={fc} placeholder="e.g. Saman's Grocery" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Owner Name *</label>
          <input value={form.owner_name} onChange={set('owner_name')} required className={fc} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contact Number *</label>
          <input value={form.contact_number} onChange={set('contact_number')} required className={fc} placeholder="+94 77 123 4567" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Shop Type</label>
          <select value={form.shop_type} onChange={set('shop_type')} className={fc}>
            <option value="retail">Retail</option>
            <option value="car_wash">Car Wash</option>
            <option value="clothing">Clothing</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Business Registration No. (optional)</label>
          <input value={form.br_number} onChange={set('br_number')} className={fc} placeholder="e.g. PV12345" />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Location
        </legend>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Google Maps Link (optional)</label>
          <input value={form.location_map_url} onChange={set('location_map_url')} className={fc} placeholder="https://maps.google.com/..." />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
            <input type="number" step="any" value={form.location_lat} onChange={set('location_lat')} className={fc} placeholder="6.9271" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
            <input type="number" step="any" value={form.location_lng} onChange={set('location_lng')} className={fc} placeholder="79.8612" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Shop Login Credentials</legend>
        <p className="text-xs text-gray-400">These will be used by the shop owner to log in.</p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
          <input type="email" value={form.email} onChange={set('email')} required className={fc} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
          <input value={form.username} onChange={set('username')} required className={fc} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
          <input type="text" value={form.password} onChange={set('password')} required minLength={6} className={fc} placeholder="min 6 characters" />
        </div>
      </fieldset>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</> : 'Register Shop'}
        </button>
      </div>
    </form>
  );
}

function InfoRow({ label, value, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs font-mono font-semibold text-gray-800 truncate">{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="p-0.5 text-gray-400 hover:text-green-600 shrink-0">
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Shops Tab ─────────────────────────────────────────────────
function ShopsTab() {
  const [shops,    setShops]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState('');
  const [showForm, setShowForm] = useState(false);
  const [qrShop,   setQrShop]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await agentApi.shops();
      setShops(Array.isArray(data) ? data : []);
    } catch {
      // Fall back to legacy customers endpoint
      try {
        const { data } = await agentApi.customers();
        setShops(Array.isArray(data) ? data : data.customers || []);
      } catch { toast.error('Failed to load shops'); }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = shops.filter((s) =>
    !query ||
    s.name?.toLowerCase().includes(query.toLowerCase()) ||
    s.owner_name?.toLowerCase().includes(query.toLowerCase()) ||
    s.email?.toLowerCase().includes(query.toLowerCase()) ||
    s.shop_reference_id?.toLowerCase().includes(query.toLowerCase())
  );

  if (loading) return <Spinner />;

  const activationBadge = (s) => {
    if (s.activation_status === 'inactive') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Inactive – Awaiting Payment</span>;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {qrShop && <ShopQRModal shop={qrShop} onClose={() => setQrShop(null)} />}

      {/* Search + Register */}
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
          <Plus className="w-4 h-4" /> Register
        </button>
      </div>

      {showForm && (
        <ShopRegisterForm
          onDone={() => { setShowForm(false); load(); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Shop list */}
      {filtered.length === 0
        ? <Empty text={query ? `No results for "${query}"` : 'No shops yet. Register your first shop!'} />
        : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                      {s.shop_reference_id && (
                        <span className="text-xs font-mono text-gray-400">{s.shop_reference_id}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{s.owner_name}</p>
                    {s.contact_number && <p className="text-xs text-gray-400">{s.contact_number}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={s.subscription_status} />
                    {activationBadge(s)}
                  </div>
                </div>

                {/* Location */}
                {(s.location_lat || s.location_map_url) && (
                  <div className="flex items-center gap-1 mt-2">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    {s.location_map_url ? (
                      <a href={s.location_map_url} target="_blank" rel="noreferrer"
                        className="text-xs text-blue-600 underline">View on map</a>
                    ) : (
                      <span className="text-xs text-gray-400">{s.location_lat}, {s.location_lng}</span>
                    )}
                  </div>
                )}

                {s.subscription_end_date && (
                  <p className="text-xs text-gray-400 mt-1">Expires: {fmtDate(s.subscription_end_date)}</p>
                )}

                {/* Actions for inactive shops */}
                {s.activation_status === 'inactive' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-orange-600 mb-2 font-medium">
                      Payment required to activate this shop account (LKR 2,500)
                    </p>
                    <button
                      onClick={() => setQrShop(s)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700"
                    >
                      <QrCode className="w-3 h-3" /> Generate HelaPay QR
                    </button>
                  </div>
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

// ── Profile / Settings Tab ────────────────────────────────────
function ProfileTab() {
  const { agent } = useAgentStore();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    bank_name: '', bank_account: '', bank_branch: '', account_holder: '',
  });
  const [loaded,  setLoaded]     = useState(false);
  const [saving,  setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const agreementRef = useRef(null);

  useEffect(() => {
    agentApi.me()
      .then(({ data }) => {
        setProfile(data);
        setForm({
          bank_name:      data.bank_name      || '',
          bank_account:   data.bank_account   || '',
          bank_branch:    data.bank_branch    || '',
          account_holder: data.account_holder || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSave(e) {
    e.preventDefault();
    if (!form.bank_name || !form.bank_account || !form.account_holder) {
      toast.error('Bank name, account number and account holder are required');
      return;
    }
    setSaving(true);
    try {
      await agentApi.bankDetails(form);
      toast.success('Bank details saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save bank details');
    } finally {
      setSaving(false);
    }
  }

  async function handleAgreementUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          await agentApi.uploadSignedAgreement({ fileData: ev.target.result });
          toast.success('Signed agreement uploaded');
          const { data } = await agentApi.me();
          setProfile(data);
        } catch {
          toast.error('Upload failed');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
      toast.error('Failed to read file');
    }
    if (agreementRef.current) agreementRef.current.value = '';
  }

  if (!loaded) return <Spinner />;

  const fc = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
  const approvalColor = {
    active:   'bg-green-100 text-green-800',
    pending:  'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
  }[profile?.approval_status || 'active'] || 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-5">
      {/* Identity card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          {profile?.agent_photo_url ? (
            <img src={profile.agent_photo_url} alt="Agent photo"
              className="w-14 h-14 rounded-full object-cover border-2 border-green-200" />
          ) : (
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-green-700" />
            </div>
          )}
          <div>
            <p className="font-bold text-gray-900">{profile?.name || agent?.name}</p>
            <p className="text-sm text-gray-500">{profile?.email || agent?.email}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${approvalColor}`}>
              {profile?.approval_status || 'active'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-gray-400">Phone</p><p className="font-medium text-gray-700">{profile?.phone || '—'}</p></div>
          <div><p className="text-gray-400">District</p><p className="font-medium text-gray-700">{profile?.district || '—'}</p></div>
          <div><p className="text-gray-400">NIC Number</p><p className="font-medium text-gray-700">{profile?.nic_number || '—'}</p></div>
          <div><p className="text-gray-400">Driving License</p><p className="font-medium text-gray-700">{profile?.driving_license_number || '—'}</p></div>
          <div className="col-span-2"><p className="text-gray-400">Member Since</p>
            <p className="font-medium text-gray-700">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' }) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Login credentials display */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-blue-700" />
          <h3 className="font-semibold text-blue-800 text-sm">Account Credentials</h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-600">Email / Login</span>
            <span className="text-xs font-mono font-semibold text-blue-900">{profile?.email || agent?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-600">Portal URL</span>
            <span className="text-xs font-mono text-blue-900">{window.location.origin}/agent/login</span>
          </div>
        </div>
        <p className="text-xs text-blue-500 mt-2">To change your password, contact your admin.</p>
      </div>

      {/* Documents */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">Uploaded Documents</h3>
        <div className="space-y-2">
          {[
            { label: 'NIC Front',          url: profile?.nic_front_url },
            { label: 'NIC Back',           url: profile?.nic_back_url },
            { label: 'Agent Photo',        url: profile?.agent_photo_url },
            { label: 'Bank Book',          url: profile?.bank_book_url },
            { label: 'Signed Agreement',   url: profile?.signed_agreement_url },
          ].map(({ label, url }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{label}</span>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-green-700 font-medium hover:underline">
                  <Eye className="w-3 h-3" /> View
                </a>
              ) : (
                <span className="text-gray-300">Not uploaded</span>
              )}
            </div>
          ))}
        </div>

        {/* Upload signed agreement */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Upload signed agreement (if not done during registration):</p>
          <input ref={agreementRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleAgreementUpload} />
          <button
            onClick={() => agreementRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? 'Uploading…' : 'Upload Signed Agreement'}
          </button>
        </div>
      </div>

      {/* Bank details form */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-green-700" />
          <h3 className="font-semibold text-gray-800 text-sm">Bank Details</h3>
        </div>
        <p className="text-xs text-gray-500">Used for commission payouts. Ensure accuracy.</p>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Account Holder Name *</label>
          <input type="text" value={form.account_holder} onChange={set('account_holder')}
            placeholder="Name as on bank account" className={fc} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name *</label>
          <input type="text" value={form.bank_name} onChange={set('bank_name')}
            placeholder="e.g. Bank of Ceylon" className={fc} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Account Number *</label>
          <input type="text" value={form.bank_account} onChange={set('bank_account')}
            placeholder="e.g. 0012345678" className={fc} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
          <input type="text" value={form.bank_branch} onChange={set('bank_branch')}
            placeholder="e.g. Colombo Main" className={fc} />
        </div>

        <button type="submit" disabled={saving}
          className="w-full py-2.5 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Bank Details</>}
        </button>
      </form>
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

// ── Renewals Tab ──────────────────────────────────────────────
function RenewalsTab() {
  const [renewals, setRenewals] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await agentApi.renewals();
      setRenewals(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load renewals'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  const expiring = renewals.filter(
    (s) => s.subscription_status === 'active' && s.subscription_end_date
  ).sort((a, b) => new Date(a.subscription_end_date) - new Date(b.subscription_end_date));

  const expired = renewals.filter((s) => s.subscription_status === 'expired');

  function daysUntil(dateStr) {
    const diff = new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
    return Math.ceil(diff / 86400000);
  }
  function daysSince(dateStr) {
    const diff = new Date().setHours(0,0,0,0) - new Date(dateStr).setHours(0,0,0,0);
    return Math.ceil(diff / 86400000);
  }

  const urgencyColor = (days) => {
    if (days <= 0)  return 'text-red-600 bg-red-50 border-red-200';
    if (days <= 3)  return 'text-red-500 bg-red-50 border-red-200';
    if (days <= 7)  return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  };

  function handleCall(phone) {
    if (phone) window.open(`tel:${phone}`);
  }

  if (renewals.length === 0) return <Empty text="No shops requiring renewal attention" />;

  return (
    <div className="space-y-5">
      {/* Summary badges */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-700">{expiring.length}</p>
          <p className="text-xs text-orange-600 mt-0.5">Expiring Soon</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{expired.length}</p>
          <p className="text-xs text-red-600 mt-0.5">Not Renewed</p>
        </div>
      </div>

      {/* Expiring soon section */}
      {expiring.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-orange-500" /> Expiring Soon
          </h3>
          <div className="space-y-2">
            {expiring.map((s) => {
              const days = daysUntil(s.subscription_end_date);
              return (
                <div key={s.id} className={`rounded-xl border p-4 ${urgencyColor(days)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{s.name}</p>
                      <p className="text-xs opacity-75">{s.owner_name}</p>
                      <p className="text-xs mt-0.5 font-medium">
                        {days <= 0
                          ? 'Expires today!'
                          : days === 1
                          ? 'Expires tomorrow'
                          : `Expires in ${days} days`}
                        {' — '}{fmtDate(s.subscription_end_date)}
                      </p>
                    </div>
                    {s.phone && (
                      <button
                        onClick={() => handleCall(s.phone)}
                        className="shrink-0 p-2 rounded-lg bg-white/60 hover:bg-white transition-colors"
                        title="Call shop"
                      >
                        <PhoneCall className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Not renewed section */}
      {expired.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-red-500" /> Not Renewed (Expired)
          </h3>
          <div className="space-y-2">
            {expired.map((s) => {
              const since = s.subscription_end_date ? daysSince(s.subscription_end_date) : null;
              return (
                <div key={s.id} className="bg-white rounded-xl border border-red-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.owner_name}</p>
                      {since !== null && (
                        <p className="text-xs text-red-600 mt-0.5">
                          Expired {since === 0 ? 'today' : `${since} day${since > 1 ? 's' : ''} ago`}
                          {s.subscription_end_date ? ` — ${fmtDate(s.subscription_end_date)}` : ''}
                        </p>
                      )}
                    </div>
                    {s.phone && (
                      <button
                        onClick={() => handleCall(s.phone)}
                        className="shrink-0 p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                        title="Call shop"
                      >
                        <PhoneCall className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard, component: DashboardTab  },
  { id: 'shops',       label: 'Shops',       icon: Store,           component: ShopsTab      },
  { id: 'renewals',    label: 'Renewals',    icon: CalendarClock,   component: RenewalsTab   },
  { id: 'payments',    label: 'Payments',    icon: CreditCard,      component: PaymentsTab   },
  { id: 'commissions', label: 'Commissions', icon: Wallet,          component: CommissionsTab},
  { id: 'profile',     label: 'Settings',    icon: Settings,        component: ProfileTab    },
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
