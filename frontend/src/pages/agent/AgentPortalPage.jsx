import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  LayoutDashboard, Store, CreditCard, Wallet, LogOut,
  TrendingUp, Users, Clock, Lock, Plus, ChevronDown,
  CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw,
  User, Building2, Save, Bell, PhoneCall, CalendarClock,
  MapPin, QrCode, Upload, Eye, Copy, FileText, Download,
  Settings, Filter, ChevronUp, Search, Calendar,
  PartyPopper, Smartphone, BadgeCheck, ArrowDownCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${statusChip(status)}`}>
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
    <div className={`${c.bg} rounded-xl p-3 sm:p-4 border border-white`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 shrink-0 ${c.icon}`} />
        <span className="text-xs text-gray-500 font-medium leading-tight">{label}</span>
      </div>
      <p className={`text-base sm:text-lg font-bold ${c.val} truncate`}>{value}</p>
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
    <div className="space-y-4 sm:space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Total Shops"   value={data.total_customers}  icon={Store}       color="green" />
        <StatCard label="Active Shops"  value={data.active_customers} icon={CheckCircle} color="blue" />
        <StatCard label="Approved Earn" value={fmtMoney(data.approved_earnings)} icon={Wallet} color="green" />
        <StatCard label="Pending Earn"  value={fmtMoney(data.pending_earnings)}  icon={Lock}   color="yellow" />
      </div>

      {/* Account balance */}
      {data.account_balance > 0 && (
        <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-xl p-4 text-white flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-green-200">Account Balance</p>
            <p className="text-2xl font-bold">{fmtMoney(data.account_balance)}</p>
          </div>
          <Wallet className="w-8 h-8 text-green-300 shrink-0" />
        </div>
      )}

      {/* Monthly target */}
      {data.monthly_target > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-sm font-semibold text-gray-700">Monthly Target</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {data.active_customers} / {data.monthly_target}
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
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            <strong>{data.pending_submissions}</strong> payment submission(s) awaiting admin verification
          </p>
        </div>
      )}

      {/* Expiring soon */}
      {data.expiring_soon?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> Expiring Soon (within 3 days)
          </h3>
          <div className="space-y-2">
            {data.expiring_soon.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-gray-800 truncate">{s.name}</span>
                <span className="text-red-600 whitespace-nowrap shrink-0">{fmtDate(s.subscription_end_date)}</span>
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
              <span className={`w-4 h-4 rounded-full text-[10px] inline-flex items-center justify-center font-bold shrink-0 ${
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Shop Type *</label>
              <select
                value={form.shop_type}
                onChange={(e) => set('shop_type', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
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
                        <div className="flex flex-wrap items-center justify-between gap-1">
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
                    className={`py-2.5 text-xs rounded-lg border font-medium transition-colors ${
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
                className="flex-1 min-h-[44px] border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                Back
              </button>
            : <button type="button" onClick={onClose}
                className="flex-1 min-h-[44px] border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
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
                className="flex-1 min-h-[44px] bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50">
                Next
              </button>
            : <button type="button" disabled={saving} onClick={handleSubmit}
                className="flex-1 min-h-[44px] bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-60 flex items-center justify-center gap-2">
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6">
        <h3 className="font-bold text-gray-900 mb-1 truncate">HelaPay QR – {shop.name}</h3>
        <p className="text-xs text-gray-500 mb-4">
          Ref: <span className="font-mono font-semibold">{shop.shop_reference_id}</span> · LKR 2,500.00
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          </div>
        ) : qr ? (
          <div className="text-center">
            <img src={qr} alt="Payment QR" className="mx-auto w-52 h-52 sm:w-56 sm:h-56 border rounded-xl p-2" />
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
          className="mt-4 w-full min-h-[44px] border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Shop Registration Form ────────────────────────────────────
const MAPS_RE = /^https?:\/\/(www\.)?(maps\.google\.|google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)/i;
const MAX_SELFIE_BYTES = 5 * 1024 * 1024;

function ShopRegisterForm({ onDone, onClose }) {
  const selfieRef = useRef(null);
  const [form, setForm] = useState({
    shop_name: '', owner_name: '', contact_number: '',
    location_map_url: '',
    br_number: '',
    email: '', username: '', password: '',
    shop_type: 'retail',
  });
  const [selfie, setSelfie]           = useState(null);   // { preview, url } after upload
  const [selfieUploading, setSelfieU] = useState(false);
  const [selfieError, setSelfieErr]   = useState('');
  const [mapUrlError, setMapUrlError] = useState('');
  const [saving, setSaving]           = useState(false);
  const [result, setResult]           = useState(null);

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((p) => ({ ...p, [k]: v }));
    if (k === 'location_map_url') {
      setMapUrlError(v && !MAPS_RE.test(v) ? 'Please enter a valid Google Maps link' : '');
    }
  };
  const fc = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  async function handleSelfieChange(e) {
    const file = e.target.files?.[0];
    if (selfieRef.current) selfieRef.current.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setSelfieErr('Only JPG and PNG images are accepted');
      return;
    }
    if (file.size > MAX_SELFIE_BYTES) {
      setSelfieErr('Image must be under 5MB');
      return;
    }
    setSelfieErr('');
    setSelfieU(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const fileData = ev.target.result;
        const { data } = await agentApi.uploadShopSelfie({ fileData, ref: form.shop_name || 'shop' });
        setSelfie({ preview: fileData, url: data.url });
        toast.success('Selfie uploaded');
      } catch (err) {
        setSelfieErr(err.response?.data?.error || 'Upload failed — try again');
      } finally {
        setSelfieU(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.shop_name || !form.owner_name || !form.contact_number) {
      toast.error('Shop Name, Owner Name and Contact Number are required');
      return;
    }
    if (!form.location_map_url) {
      toast.error('Google Maps link is required');
      return;
    }
    if (!MAPS_RE.test(form.location_map_url)) {
      toast.error('Please enter a valid Google Maps link');
      return;
    }
    if (!selfie?.url) {
      toast.error('Please upload a selfie with the shop clearly visible');
      return;
    }
    if (!form.email || !form.username || !form.password) {
      toast.error('Shop login credentials are required');
      return;
    }
    setSaving(true);
    try {
      const { data } = await agentApi.registerShop({ ...form, selfie_url: selfie.url });
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
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
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
          <button onClick={onClose} className="flex-1 min-h-[44px] border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Close</button>
          <button onClick={onDone} className="flex-1 min-h-[44px] bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800">
            Register Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4">
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

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Location
        </legend>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Google Maps Link <span className="text-red-500">*</span>
          </label>
          <input
            value={form.location_map_url}
            onChange={set('location_map_url')}
            required
            className={`${fc} ${mapUrlError ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="https://maps.google.com/maps?q=..."
          />
          {mapUrlError && <p className="text-xs text-red-500 mt-1">{mapUrlError}</p>}
          <p className="text-xs text-gray-400 mt-1">
            Open Google Maps → find the location → tap Share → Copy link
          </p>
        </div>
      </fieldset>

      {/* Selfie upload */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <User className="w-3 h-3" /> Selfie
        </legend>
        <p className="text-xs text-gray-400">
          Take a photo of yourself standing in front of the shop — the shop signage must be clearly visible.
        </p>

        <input
          ref={selfieRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          className="hidden"
          onChange={handleSelfieChange}
        />

        {selfie?.preview ? (
          <div className="space-y-2">
            <img
              src={selfie.preview}
              alt="Shop selfie preview"
              className="w-full max-h-48 object-cover rounded-xl border border-gray-200"
            />
            <button
              type="button"
              onClick={() => { setSelfie(null); setSelfieErr(''); }}
              className="text-xs text-red-500 hover:underline"
            >
              Remove & re-upload
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => selfieRef.current?.click()}
            disabled={selfieUploading}
            className={`flex items-center justify-center gap-2 w-full min-h-[56px] border-2 border-dashed rounded-xl text-sm transition-colors disabled:opacity-60 ${
              selfieError
                ? 'border-red-400 text-red-500 bg-red-50'
                : 'border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            {selfieUploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              : <><Upload className="w-4 h-4" /> Selfie with Shop <span className="text-red-500">*</span></>
            }
          </button>
        )}
        {selfieError && <p className="text-xs text-red-500">{selfieError}</p>}
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
        <button type="button" onClick={onClose} className="flex-1 min-h-[44px] border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 min-h-[44px] bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-60 flex items-center justify-center gap-2">
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
          <button onClick={onCopy} className="p-1 text-gray-400 hover:text-green-600 shrink-0 min-h-[44px] min-w-[32px] flex items-center justify-center">
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
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 whitespace-nowrap">Awaiting Payment</span>;
    }
    return null;
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {qrShop && <ShopQRModal shop={qrShop} onClose={() => setQrShop(null)} />}

      {/* Search + Register — stack on very small screens */}
      <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
        <input
          className="flex-1 min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Search shops…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800 whitespace-nowrap"
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
                        <span className="text-xs font-mono text-gray-400 shrink-0">{s.shop_reference_id}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{s.owner_name}</p>
                    {s.contact_number && <p className="text-xs text-gray-400">{s.contact_number}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={s.subscription_status} />
                    {activationBadge(s)}
                  </div>
                </div>

                {/* Location */}
                {s.location_map_url && (
                  <a
                    href={s.location_map_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline w-fit"
                  >
                    <MapPin className="w-3 h-3 shrink-0" />
                    View on Google Maps
                  </a>
                )}

                {s.subscription_end_date && (
                  <p className="text-xs text-gray-400 mt-1">Expires: {fmtDate(s.subscription_end_date)}</p>
                )}

                {/* Actions for inactive shops */}
                {s.activation_status === 'inactive' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-orange-600 mb-2 font-medium">
                      Payment required to activate this shop (LKR 2,500)
                    </p>
                    <button
                      onClick={() => setQrShop(s)}
                      className="flex items-center gap-1.5 min-h-[44px] px-4 py-2 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Generate HelaPay QR
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
// ── HelaPlay Deposit QR Panel ─────────────────────────────────
function DepositQRPanel({ onPaid }) {
  const [qrSession,   setQrSession]   = useState(null);
  const [generating,  setGenerating]  = useState(true);  // start generating immediately
  const [genError,    setGenError]    = useState('');
  const [status,      setStatus]      = useState(0);
  const [timeLeft,    setTimeLeft]    = useState(0);

  const pollRef      = useRef(null);
  const countdownRef = useRef(null);

  const clearPolling = useCallback(() => {
    clearInterval(pollRef.current);
    clearInterval(countdownRef.current);
  }, []);

  useEffect(() => () => clearPolling(), [clearPolling]);

  function startPolling(reference, expiresAt) {
    clearPolling();
    const expiryMs = new Date(expiresAt).getTime();

    countdownRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) clearPolling();
    }, 1000);

    pollRef.current = setInterval(async () => {
      if (Date.now() >= expiryMs) { clearPolling(); setStatus(-2); return; }
      try {
        const { data } = await agentApi.depositStatus(reference);
        setStatus(data.payment_status);
        if (data.payment_status === 2) {
          clearPolling();
          setTimeout(() => onPaid?.(), 2500);
        } else if (data.payment_status !== 0) {
          clearPolling();
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
  }

  const generateQR = useCallback(async () => {
    setGenerating(true);
    setGenError('');
    setStatus(0);
    setQrSession(null);
    try {
      const { data } = await agentApi.generateDepositQR();
      setQrSession(data);
      setTimeLeft(Math.ceil((new Date(data.expires_at) - Date.now()) / 1000));
      startPolling(data.reference, data.expires_at);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to generate QR code. Please try again.';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate on mount
  useEffect(() => { generateQR(); }, [generateQR]);

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');

  // Paid state
  if (status === 2) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
        <PartyPopper className="w-12 h-12 text-green-500" />
        <p className="text-lg font-bold text-green-700">Payment Received!</p>
        <p className="text-sm text-gray-500">LKR 500 has been credited to your account balance.</p>
      </div>
    );
  }

  // Generating / loading state
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        <p className="text-sm text-gray-500">Generating QR code…</p>
      </div>
    );
  }

  // Error state
  if (genError) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-red-600 font-medium">{genError}</p>
        <button
          onClick={generateQR}
          className="min-h-[44px] px-6 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Expired state
  if (status === -2 || (qrSession && timeLeft === 0)) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-gray-500">QR code expired.</p>
        <button
          onClick={generateQR}
          className="min-h-[44px] px-6 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition-colors"
        >
          Generate New QR
        </button>
      </div>
    );
  }

  // Live QR state — detect if qr_data is already a base64 image or a raw QR string
  if (qrSession && qrSession.qr_data) {
    const isImageUrl = qrSession.qr_data.startsWith('data:image') ||
                       qrSession.qr_data.startsWith('http');
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
          {isImageUrl
            ? <img src={qrSession.qr_data} alt="HelaPlay QR" className="w-[220px] h-[220px] object-contain" />
            : <QRCodeSVG value={qrSession.qr_data} size={220} level="M" />
          }
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 text-green-600 animate-spin shrink-0" />
          <span className="text-gray-600">Waiting for payment…</span>
          <span className="font-mono font-semibold text-green-700">{minutes}:{seconds}</span>
        </div>
        <p className="text-xs text-gray-400 text-center">Scan with HelaPlay app to pay LKR 2,500</p>
      </div>
    );
  }

  // Fallback — shouldn't reach here
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-sm text-gray-400">Something went wrong.</p>
      <button onClick={generateQR} className="min-h-[44px] px-6 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800">
        Retry
      </button>
    </div>
  );
}

// ── My Account sub-tab ────────────────────────────────────────
function MyAccountPanel() {
  const [data,    setData]    = useState({ balance: 0, history: [] });
  const [loading, setLoading] = useState(true);
  const [showQR,  setShowQR]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await agentApi.depositHistory();
      setData(d);
    } catch { toast.error('Failed to load account data'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handlePaid() {
    setShowQR(false);
    load();
  }

  if (loading) return <Spinner />;

  const statusLabel = { pending: 'Pending', completed: 'Completed', failed: 'Failed' };
  const statusColor = {
    completed: 'bg-green-100 text-green-800',
    pending:   'bg-yellow-100 text-yellow-800',
    failed:    'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-5 text-white">
        <p className="text-sm text-green-100 mb-1">Account Balance</p>
        <p className="text-3xl font-bold">{fmtMoney(data.balance)}</p>
        <p className="text-xs text-green-200 mt-1">Pay 2,500 → receive 500 credit</p>
      </div>

      {/* Top-up section */}
      {showQR ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-800 text-sm">HelaPlay QR Top-Up</p>
            <button onClick={() => setShowQR(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
          <DepositQRPanel onPaid={handlePaid} />
        </div>
      ) : (
        <button
          onClick={() => setShowQR(true)}
          className="w-full min-h-[48px] border-2 border-dashed border-green-300 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <QrCode className="w-4 h-4" /> Top Up via HelaPlay QR
        </button>
      )}

      {/* Deposit history */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Deposit History</p>
        {data.history.length === 0
          ? <Empty text="No deposits yet" />
          : (
            <div className="space-y-2">
              {data.history.map((h) => (
                <div key={h.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{fmtMoney(h.amount_paid)} paid</p>
                    <p className="text-xs text-green-700 font-medium">+{fmtMoney(h.credited)} credited</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtDate(h.paid_at || h.created_at)} · HelaPlay QR
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusColor[h.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabel[h.status] || h.status}
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}

function PaymentsTab() {
  const [subTab, setSubTab] = useState('shop');  // 'shop' | 'account'

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

  useEffect(() => { if (subTab === 'shop') load(); }, [load, subTab]);

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

  const payStatusLabel = { pending_verification:'Pending', verified:'Verified', rejected:'Rejected' };

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex rounded-xl border border-gray-200 bg-gray-100 p-1 gap-1">
        {[
          { id: 'shop',    label: 'Shop Payments' },
          { id: 'account', label: 'My Account'    },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex-1 min-h-[36px] rounded-lg text-sm font-medium transition-colors ${
              subTab === t.id
                ? 'bg-white text-green-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* My Account sub-tab */}
      {subTab === 'account' && <MyAccountPanel />}

      {/* Shop Payments sub-tab */}
      {subTab === 'shop' && (
        <>
          {/* Header row */}
          <div className="flex flex-col xs:flex-row xs:items-center gap-2 xs:justify-between">
            <h3 className="font-semibold text-gray-700 text-sm">Payment Submissions</h3>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date *</label>
                <input
                  type="date" required
                  max={todayStr()}
                  value={form.payment_date}
                  onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  className="flex-1 min-h-[44px] border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 min-h-[44px] bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit'}
                </button>
              </div>
            </form>
          )}

          {/* Payments list */}
          {loading
            ? <Spinner />
            : payments.length === 0
            ? <Empty text="No payment submissions yet" />
            : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{p.shop_name}</p>
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
        </>
      )}
    </div>
  );
}

// ── Commissions Tab ───────────────────────────────────────────
const COMM_STATUS_OPTS = [
  { value: '',         label: 'All Statuses' },
  { value: 'pending',  label: 'Pending'  },
  { value: 'approved', label: 'Approved' },
  { value: 'paid',     label: 'Paid'     },
];
const COMM_TYPE_OPTS = [
  { value: '',            label: 'All Types'   },
  { value: 'onboarding',  label: 'Onboarding' },
  { value: 'monthly',     label: 'Monthly'    },
];

function CommissionsTab() {
  const [list,     setList]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  // Filters
  const [statusF,  setStatusF]  = useState('');
  const [typeF,    setTypeF]    = useState('');
  const [shopQ,    setShopQ]    = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  // Table sort
  const [sortCol,  setSortCol]  = useState('earned_date');
  const [sortAsc,  setSortAsc]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await agentApi.commissions();
      setList(Array.isArray(data) ? data : data.commissions || []);
    } catch { toast.error('Failed to load commissions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived summary (all rows, no filters) ───────────────────
  const totalAll      = list.reduce((s, c) => s + Number(c.amount), 0);
  const totalPending  = list.filter((c) => ['pending','locked'].includes(c.status))
                            .reduce((s, c) => s + Number(c.amount), 0);
  const totalApproved = list.filter((c) => c.status === 'approved')
                            .reduce((s, c) => s + Number(c.amount), 0);
  const totalPaid     = list.filter((c) => c.status === 'paid')
                            .reduce((s, c) => s + Number(c.amount), 0);

  // ── Filtered + sorted rows ───────────────────────────────────
  const filtered = useMemo(() => {
    let rows = list;

    if (statusF) {
      rows = rows.filter((c) =>
        statusF === 'pending'
          ? ['pending','locked'].includes(c.status)
          : c.status === statusF
      );
    }
    if (typeF)   rows = rows.filter((c) => c.commission_type === typeF);
    if (shopQ)   rows = rows.filter((c) => c.shop_name?.toLowerCase().includes(shopQ.toLowerCase()));
    if (dateFrom) rows = rows.filter((c) => {
      const d = c.earned_date || c.created_at;
      return d && new Date(d) >= new Date(dateFrom);
    });
    if (dateTo)  rows = rows.filter((c) => {
      const d = c.earned_date || c.created_at;
      return d && new Date(d) <= new Date(dateTo + 'T23:59:59');
    });

    return [...rows].sort((a, b) => {
      let av, bv;
      if (sortCol === 'amount') {
        av = Number(a.amount); bv = Number(b.amount);
      } else if (sortCol === 'earned_date') {
        av = new Date(a.earned_date || a.created_at || 0);
        bv = new Date(b.earned_date || b.created_at || 0);
      } else if (sortCol === 'paid_at') {
        av = new Date(a.paid_at || 0); bv = new Date(b.paid_at || 0);
      } else {
        av = (a[sortCol] || '').toString().toLowerCase();
        bv = (b[sortCol] || '').toString().toLowerCase();
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ?  1 : -1;
      return 0;
    });
  }, [list, statusF, typeF, shopQ, dateFrom, dateTo, sortCol, sortAsc]);

  function toggleSort(col) {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(false); }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortAsc
      ? <ChevronUp   className="w-3 h-3 text-primary-600" />
      : <ChevronDown className="w-3 h-3 text-primary-600" />;
  }

  function clearFilters() {
    setStatusF(''); setTypeF(''); setShopQ(''); setDateFrom(''); setDateTo('');
  }

  const hasFilters = statusF || typeF || shopQ || dateFrom || dateTo;

  const COMM_STATUS_COLOR = {
    pending:  'bg-yellow-100 text-yellow-800',
    locked:   'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    paid:     'bg-blue-100 text-blue-800',
  };
  const COMM_TYPE_COLOR = {
    onboarding: 'bg-purple-100 text-purple-700',
    monthly:    'bg-indigo-100 text-indigo-700',
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Total Earned"  value={fmtMoney(totalAll)}      icon={TrendingUp}  color="green"  />
        <StatCard label="Pending"       value={fmtMoney(totalPending)}   icon={Lock}        color="yellow" />
        <StatCard label="Approved"      value={fmtMoney(totalApproved)}  icon={CheckCircle} color="green"  />
        <StatCard label="Paid Out"      value={fmtMoney(totalPaid)}      icon={Wallet}      color="blue"   />
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 space-y-3">
        {/* Row 1: shop search + type + status */}
        <div className="flex flex-wrap gap-2">
          {/* Shop search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search shop…"
              value={shopQ}
              onChange={(e) => setShopQ(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {/* Type filter */}
          <select
            value={typeF}
            onChange={(e) => setTypeF(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
          >
            {COMM_TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Status filter */}
          <select
            value={statusF}
            onChange={(e) => setStatusF(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
          >
            {COMM_STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Row 2: date range */}
        <div className="flex flex-wrap gap-2 items-center">
          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
          />
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Result count */}
        <p className="text-xs text-gray-400">
          Showing {filtered.length} of {list.length} commissions
          {hasFilters && ' (filtered)'}
        </p>
      </div>

      {/* ── Table (desktop) / Cards (mobile) ── */}
      {filtered.length === 0 ? (
        <Empty text={hasFilters ? 'No commissions match your filters' : 'No commissions yet'} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[
                      { col: 'shop_name',    label: 'Shop Name'   },
                      { col: 'commission_type', label: 'Type'     },
                      { col: 'amount',       label: 'Amount'      },
                      { col: 'earned_date',  label: 'Earned Date' },
                      { col: 'status',       label: 'Status'      },
                      { col: 'paid_at',      label: 'Paid Date'   },
                    ].map(({ col, label }) => (
                      <th
                        key={col}
                        onClick={() => toggleSort(col)}
                        className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide
                                   cursor-pointer select-none hover:text-gray-800 whitespace-nowrap"
                      >
                        <span className="flex items-center gap-1">
                          {label} <SortIcon col={col} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">
                        {c.shop_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize
                                         ${COMM_TYPE_COLOR[c.commission_type] || 'bg-gray-100 text-gray-600'}`}>
                          {c.commission_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                        {fmtMoney(c.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {fmtDate(c.earned_date || c.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize
                                         ${COMM_STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-600'}`}>
                          {c.status === 'pending' || c.status === 'locked' ? 'pending' : c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {c.paid_at ? fmtDate(c.paid_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer: total of visible rows */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm">
              <span className="text-gray-500">{filtered.length} records</span>
              <span className="font-bold text-gray-900">
                Total: {fmtMoney(filtered.reduce((s, c) => s + Number(c.amount), 0))}
              </span>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900 text-sm leading-snug truncate">{c.shop_name}</p>
                  <p className="font-bold text-gray-900 text-sm shrink-0">{fmtMoney(c.amount)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize
                                   ${COMM_TYPE_COLOR[c.commission_type] || 'bg-gray-100 text-gray-600'}`}>
                    {c.commission_type}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize
                                   ${COMM_STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-600'}`}>
                    {c.status === 'pending' || c.status === 'locked' ? 'pending' : c.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Earned: {fmtDate(c.earned_date || c.created_at)}</span>
                  {c.paid_at && <span>Paid: {fmtDate(c.paid_at)}</span>}
                </div>
              </div>
            ))}

            {/* Mobile footer */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex justify-between text-sm font-semibold text-gray-700">
              <span>Total ({filtered.length})</span>
              <span>{fmtMoney(filtered.reduce((s, c) => s + Number(c.amount), 0))}</span>
            </div>
          </div>
        </>
      )}
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
  const [loaded,    setLoaded]    = useState(false);
  const [saving,    setSaving]    = useState(false);
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

  const fc = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
  const approvalColor = {
    active:   'bg-green-100 text-green-800',
    pending:  'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
  }[profile?.approval_status || 'active'] || 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Identity card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          {profile?.agent_photo_url ? (
            <img src={profile.agent_photo_url} alt="Agent photo"
              className="w-14 h-14 rounded-full object-cover border-2 border-green-200 shrink-0" />
          ) : (
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-green-700" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{profile?.name || agent?.name}</p>
            <p className="text-sm text-gray-500 truncate">{profile?.email || agent?.email}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${approvalColor}`}>
              {profile?.approval_status || 'active'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-gray-400">Phone</p><p className="font-medium text-gray-700">{profile?.phone || '—'}</p></div>
          <div><p className="text-gray-400">District</p><p className="font-medium text-gray-700">{profile?.district || '—'}</p></div>
          <div><p className="text-gray-400">NIC Number</p><p className="font-medium text-gray-700 break-all">{profile?.nic_number || '—'}</p></div>
          <div><p className="text-gray-400">Driving License</p><p className="font-medium text-gray-700">{profile?.driving_license_number || '—'}</p></div>
          <div className="col-span-2">
            <p className="text-gray-400">Member Since</p>
            <p className="font-medium text-gray-700">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' }) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Login credentials */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-blue-700 shrink-0" />
          <h3 className="font-semibold text-blue-800 text-sm">Account Credentials</h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-blue-600 shrink-0">Email / Login</span>
            <span className="text-xs font-mono font-semibold text-blue-900 text-right break-all">{profile?.email || agent?.email}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-blue-600 shrink-0">Portal URL</span>
            <span className="text-xs font-mono text-blue-900 text-right break-all">{window.location.origin}/agent/login</span>
          </div>
        </div>
        <p className="text-xs text-blue-500 mt-2">To change your password, contact your admin.</p>
      </div>

      {/* Documents */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">Uploaded Documents</h3>
        <div className="space-y-2">
          {[
            { label: 'NIC Front',        url: profile?.nic_front_url },
            { label: 'NIC Back',         url: profile?.nic_back_url },
            { label: 'Agent Photo',      url: profile?.agent_photo_url },
            { label: 'Bank Book',        url: profile?.bank_book_url },
            { label: 'Signed Agreement', url: profile?.signed_agreement_url },
          ].map(({ label, url }) => (
            <div key={label} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500 shrink-0">{label}</span>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-green-700 font-medium hover:underline min-h-[32px]">
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
            className="flex items-center gap-1.5 min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? 'Uploading…' : 'Upload Signed Agreement'}
          </button>
        </div>
      </div>

      {/* Bank details form */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-green-700 shrink-0" />
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
          className="w-full min-h-[44px] bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-60 flex items-center justify-center gap-2">
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
  return <p className="text-center text-gray-400 py-16 text-sm px-4">{text}</p>;
}

// ── Subscriptions / Renewals Tab ──────────────────────────────
function RenewalsTab() {
  const [shops,   setShops]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusF, setStatusF] = useState('all');   // all | active | expired | inactive
  const [search,  setSearch]  = useState('');
  const [noteOpen,  setNoteOpen]  = useState(null); // shop id with open note editor
  const [noteText,  setNoteText]  = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await agentApi.subscriptions();
      setShops(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load subscriptions'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const diff = new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
    return Math.ceil(diff / 86400000);
  }

  const filtered = useMemo(() => {
    let list = shops;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name?.toLowerCase().includes(q) || s.owner_name?.toLowerCase().includes(q));
    }
    if (statusF !== 'all') {
      list = list.filter((s) => {
        if (statusF === 'active')   return s.subscription_status === 'active';
        if (statusF === 'expired')  return s.subscription_status === 'expired';
        if (statusF === 'inactive') return s.activation_status !== 'active';
        return true;
      });
    }
    return list;
  }, [shops, search, statusF]);

  const expiringSoon = useMemo(
    () => shops.filter((s) => {
      const d = daysUntil(s.subscription_end_date);
      return d !== null && d <= 7 && s.subscription_status === 'active';
    }).length,
    [shops]
  );
  const expiredCount = shops.filter((s) => s.subscription_status === 'expired').length;
  const activeCount  = shops.filter((s) => s.subscription_status === 'active').length;

  function openNote(shop) {
    setNoteOpen(shop.id);
    setNoteText(shop.follow_up_note || '');
  }
  function closeNote() { setNoteOpen(null); setNoteText(''); }

  async function saveNote(shopId) {
    setNoteSaving(true);
    try {
      await agentApi.saveShopNote(shopId, noteText);
      setShops((prev) => prev.map((s) => s.id === shopId ? { ...s, follow_up_note: noteText } : s));
      toast.success('Note saved');
      closeNote();
    } catch { toast.error('Failed to save note'); }
    finally  { setNoteSaving(false); }
  }

  function urgencyRowClass(days) {
    if (days === null) return '';
    if (days <= 0) return 'border-l-4 border-l-red-500';
    if (days <= 3) return 'border-l-4 border-l-red-400';
    if (days <= 7) return 'border-l-4 border-l-orange-400';
    return '';
  }

  function renewalLabel(s) {
    const days = daysUntil(s.subscription_end_date);
    if (days === null) return <span className="text-gray-400">—</span>;
    if (days < 0)  return <span className="text-red-600 font-semibold">Expired {Math.abs(days)}d ago</span>;
    if (days === 0) return <span className="text-red-600 font-semibold">Expires today</span>;
    if (days === 1) return <span className="text-orange-600 font-semibold">Tomorrow</span>;
    if (days <= 7) return <span className="text-orange-600 font-semibold">In {days} days</span>;
    return <span className="text-gray-600">In {days} days</span>;
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-green-700">{activeCount}</p>
          <p className="text-[10px] sm:text-xs text-green-600 mt-0.5">Active</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-orange-700">{expiringSoon}</p>
          <p className="text-[10px] sm:text-xs text-orange-600 mt-0.5">Expiring ≤7d</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-red-700">{expiredCount}</p>
          <p className="text-[10px] sm:text-xs text-red-600 mt-0.5">Expired</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shops…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={statusF} onChange={(e) => setStatusF(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          <option value="all">All Shops ({shops.length})</option>
          <option value="active">Active ({activeCount})</option>
          <option value="expired">Expired ({expiredCount})</option>
          <option value="inactive">Not Activated</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-1/4">Shop</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Plan</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">End Date</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Renewal</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Last Payment</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-10 text-sm">No shops found</td>
              </tr>
            )}
            {filtered.map((s) => {
              const days = daysUntil(s.subscription_end_date);
              const followUpRequired = days !== null && days <= 7 && s.subscription_status === 'active';
              return (
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${urgencyRowClass(days)}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 truncate max-w-[180px]">{s.name}</div>
                    <div className="text-xs text-gray-500 truncate">{s.owner_name}</div>
                    {followUpRequired && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-orange-700 bg-orange-100 rounded px-1.5 py-0.5">
                        <Bell className="w-2.5 h-2.5" /> Follow-up Required
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.plan_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusChip(s.subscription_status)}`}>
                      {s.subscription_status?.replace(/_/g, ' ') || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(s.subscription_end_date)}</td>
                  <td className="px-4 py-3 text-xs">{renewalLabel(s)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(s.last_payment_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {s.phone && (
                        <button
                          onClick={() => window.open(`tel:${s.phone}`)}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-700 transition-colors"
                          title="Call"
                        >
                          <PhoneCall className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openNote(s)}
                        className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${s.follow_up_note ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                        title={s.follow_up_note ? 'Edit note' : 'Add note'}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            {filtered.length} shop{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {filtered.length === 0 && <Empty text="No shops found" />}
        {filtered.map((s) => {
          const days = daysUntil(s.subscription_end_date);
          const followUpRequired = days !== null && days <= 7 && s.subscription_status === 'active';
          const borderClass = days !== null && days <= 7 ? 'border-l-4 border-l-orange-400' : days !== null && days <= 0 ? 'border-l-4 border-l-red-500' : '';
          return (
            <div key={s.id} className={`bg-white rounded-xl border border-gray-200 p-4 ${borderClass}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                    {followUpRequired && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700 bg-orange-100 rounded px-1.5 py-0.5 shrink-0">
                        <Bell className="w-2.5 h-2.5" /> Follow-up
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{s.owner_name}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {s.phone && (
                    <button
                      onClick={() => window.open(`tel:${s.phone}`)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <PhoneCall className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openNote(s)}
                    className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors ${s.follow_up_note ? 'text-green-700 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                <div>
                  <span className="text-gray-400">Plan: </span>
                  {s.plan_name || '—'}
                </div>
                <div>
                  <span className="text-gray-400">Status: </span>
                  <span className={`inline-block font-semibold px-1.5 py-0.5 rounded-full text-[10px] ${statusChip(s.subscription_status)}`}>
                    {s.subscription_status?.replace(/_/g, ' ') || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">End: </span>
                  {fmtDate(s.subscription_end_date)}
                </div>
                <div>
                  <span className="text-gray-400">Renewal: </span>
                  {renewalLabel(s)}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400">Last payment: </span>
                  {fmtDate(s.last_payment_date)}
                </div>
                {s.follow_up_note && (
                  <div className="col-span-2 mt-1 text-green-700 bg-green-50 rounded p-2 italic">
                    "{s.follow_up_note}"
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Note editor modal */}
      {noteOpen !== null && (() => {
        const shop = shops.find((s) => s.id === noteOpen);
        if (!shop) return null;
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
              <div className="p-4 border-b border-gray-100">
                <p className="font-semibold text-gray-900">Follow-up Note</p>
                <p className="text-xs text-gray-500">{shop.name}</p>
              </div>
              <div className="p-4">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                  placeholder="Add a follow-up note for this shop…"
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  autoFocus
                />
              </div>
              <div className="p-4 pt-0 flex gap-2">
                <button
                  onClick={closeNote}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveNote(noteOpen)}
                  disabled={noteSaving}
                  className="flex-1 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  {noteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Note
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard, component: DashboardTab  },
  { id: 'shops',       label: 'Shops',       icon: Store,           component: ShopsTab      },
  { id: 'renewals',    label: 'Subscriptions', icon: CalendarClock,   component: RenewalsTab   },
  { id: 'payments',    label: 'Payments',    icon: CreditCard,      component: PaymentsTab   },
  { id: 'commissions', label: 'Commissions', icon: Wallet,          component: CommissionsTab},
  { id: 'profile',     label: 'Settings',    icon: Settings,        component: ProfileTab    },
];

// ── Real-time agent WebSocket hook ───────────────────────────
function useAgentWebSocket(agentId, onShopActivated) {
  const wsRef = useRef(null);

  useEffect(() => {
    if (!agentId) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host  = window.location.hostname;
    const port  = process.env.REACT_APP_WS_PORT || '5000';
    const url   = `${proto}://${host}:${port}/ws`;

    let reconnectTimer = null;
    let alive = true;

    function connect() {
      if (!alive) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'subscribe_agent', agentId }));
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'agent_event' && msg.event === 'shop_activated') {
            onShopActivated?.(msg);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (alive) reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Main Portal ───────────────────────────────────────────────
export default function AgentPortalPage() {
  const { agent, logout } = useAgentStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  // Activation notifications: array of { shop_id, shop_name, method, ts }
  const [activationNotifs, setActivationNotifs] = useState([]);

  const handleShopActivated = useCallback((msg) => {
    const notif = {
      shop_id:   msg.shop_id,
      shop_name: msg.shop_name,
      method:    msg.method,
      ts:        Date.now(),
    };
    setActivationNotifs((prev) => [notif, ...prev.slice(0, 4)]);
    toast.success(`Shop "${msg.shop_name}" has been activated!`, {
      duration: 6000,
      icon: '🎉',
    });
  }, []);

  useAgentWebSocket(agent?.id, handleShopActivated);

  function dismissNotif(ts) {
    setActivationNotifs((prev) => prev.filter((n) => n.ts !== ts));
  }

  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component || DashboardTab;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-800 to-green-700 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-base sm:text-lg leading-tight truncate">{agent?.name || 'Agent Portal'}</p>
            {agent?.district && (
              <p className="text-green-200 text-xs truncate">{agent.district}</p>
            )}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-green-200 hover:text-white text-sm transition-colors shrink-0 min-h-[44px] px-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        {/* Tab bar — icons only on xs, icons + label on sm+ */}
        <div className="max-w-5xl mx-auto px-2 sm:px-4 flex overflow-x-auto scrollbar-none pb-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors shrink-0 min-h-[48px] ${
                activeTab === t.id
                  ? 'border-white text-white'
                  : 'border-transparent text-green-200 hover:text-white'
              }`}
            >
              <t.icon className="w-4 h-4 sm:w-4 sm:h-4" />
              <span className="text-[10px] sm:text-sm leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Activation notification banners */}
      {activationNotifs.length > 0 && (
        <div className="max-w-5xl mx-auto w-full px-3 sm:px-4 pt-3 space-y-2">
          {activationNotifs.map((n) => (
            <div key={n.ts}
              className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-xl px-4 py-3 shadow-sm"
            >
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800">
                  Shop "{n.shop_name}" has been activated!
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  LKR 500 onboarding commission is now approved
                  {n.method ? ` · paid via ${n.method}` : ''}
                </p>
              </div>
              <button
                onClick={() => dismissNotif(n.ts)}
                className="shrink-0 text-green-600 hover:text-green-800 p-1"
                aria-label="Dismiss"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6">
        <ActiveComponent />
      </main>
    </div>
  );
}
