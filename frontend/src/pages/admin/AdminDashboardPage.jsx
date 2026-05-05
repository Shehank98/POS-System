import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Store, CreditCard, CheckCircle2, XCircle,
  Clock, LogOut, RefreshCw, Eye, ChevronDown, ChevronUp,
  AlertTriangle, Users, ClipboardList, Plus, CalendarPlus,
  KeyRound, Loader2, BarChart2, TrendingUp, DollarSign,
  ShoppingCart, Package, Trash2, UserPlus, Search,
  Bell, Send, Layers, Edit3, ToggleLeft, ToggleRight,
  UserCheck, Phone, Mail, MapPin, Wallet, Lock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/client';
import useAdminStore from '../../store/adminStore';

const fmtDate  = (d) => d ? new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }) : '-';
const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

const PAY_STATUS = {
  pending:  { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-700' },
  verified: { label: 'Approved', cls: 'bg-green-100  text-green-700'  },
  rejected: { label: 'Rejected', cls: 'bg-red-100    text-red-700'    },
};

const SUB_STATUS = {
  active:          { label: 'Active',          cls: 'bg-green-100  text-green-700'  },
  trial:           { label: 'Trial',           cls: 'bg-blue-100   text-blue-700'   },
  expired:         { label: 'Expired',         cls: 'bg-red-100    text-red-700'    },
  suspended:       { label: 'Suspended',       cls: 'bg-gray-100   text-gray-700'   },
  pending_payment: { label: 'Pending Payment', cls: 'bg-orange-100 text-orange-700' },
};

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function ProofModal({ paymentId, onClose }) {
  const [proofUrl, setProofUrl] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    adminApi.getProof(paymentId)
      .then(({ data }) => setProofUrl(data.payment_proof))
      .catch(() => toast.error('Failed to load proof'))
      .finally(() => setLoading(false));
  }, [paymentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-4 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Payment Proof</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        {loading && <div className="h-40 bg-gray-700 rounded animate-pulse" />}
        {!loading && !proofUrl && <p className="text-gray-400 text-sm text-center py-8">No proof image uploaded</p>}
        {!loading && proofUrl && (
          <img src={proofUrl} alt="payment proof" className="w-full rounded-lg object-contain max-h-96" />
        )}
      </div>
    </div>
  );
}

function RejectModal({ paymentId, onClose, onDone }) {
  const [notes, setNotes] = useState('');
  const [busy,  setBusy]  = useState(false);

  async function handleReject() {
    setBusy(true);
    try {
      await adminApi.rejectPayment(paymentId, { notes });
      toast.success('Payment rejected');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-5 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-white">Reject Payment</p>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Reason (optional)</label>
          <textarea
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2
                       focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            rows={3}
            placeholder="e.g. Wrong amount, unclear screenshot..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button className="flex-1 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600" onClick={onClose}>
            Cancel
          </button>
          <button
            className="flex-1 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
            onClick={handleReject}
            disabled={busy}
          >
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Shop Modal ─────────────────────────────────────────
function CreateShopModal({ onClose, onCreated }) {
  const empty = {
    name:'', owner_name:'', email:'', phone:'', address:'',
    logo_url:'', contact_email:'',
    owner_username:'', owner_password:'',
    subscription_months:'1', barcode_enabled: false,
    shop_type: 'retail',
  };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // shows Shop ID after creation

  const set = (f) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [f]: v }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await adminApi.createShop({
        ...form,
        subscription_months: parseInt(form.subscription_months, 10) || 1,
      });
      setResult(data);
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create shop');
    } finally {
      setBusy(false);
    }
  }

  const inputCls = 'w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-500';

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <p className="font-semibold text-white">Shop Created!</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Shop ID</span>
              <span className="font-mono font-bold text-yellow-400 text-lg">{result.shop.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Shop Name</span>
              <span className="text-white">{result.shop.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Login Username</span>
              <span className="text-white font-mono">{result.owner.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Expires</span>
              <span className="text-white">{new Date(result.shop.subscription_end_date).toLocaleDateString()}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">Give the Shop ID and credentials to the shop owner to log in.</p>
          <button onClick={onClose} className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-white text-lg">Create New Shop</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Two-column layout on wide modal */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* ── Left column: Shop Info ── */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Shop Info</p>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Shop Name *</label>
                <input className={inputCls} placeholder="e.g. Kedai Ali" value={form.name} onChange={set('name')} required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input className={inputCls} placeholder="+60 12-345 6789" value={form.phone} onChange={set('phone')} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Contact Email</label>
                <input className={inputCls} type="email" placeholder="shop@email.com" value={form.contact_email} onChange={set('contact_email')} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Address</label>
                <input className={inputCls} placeholder="123 Jalan Utama, Kuala Lumpur" value={form.address} onChange={set('address')} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Logo URL <span className="text-gray-600">(receipt logo)</span>
                </label>
                <input className={inputCls} placeholder="https://..." value={form.logo_url} onChange={set('logo_url')} />
              </div>
            </div>

            {/* ── Right column: Owner Account ── */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Owner Account</p>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Owner Full Name *</label>
                <input className={inputCls} placeholder="Ali bin Abu" value={form.owner_name} onChange={set('owner_name')} required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Login Email *</label>
                <input className={inputCls} type="email" placeholder="ali@email.com" value={form.email} onChange={set('email')} required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Owner Username *</label>
                <input className={inputCls} placeholder="ali_owner" value={form.owner_username} onChange={set('owner_username')} required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Owner Password *</label>
                <input className={inputCls} type="password" placeholder="••••••••" value={form.owner_password} onChange={set('owner_password')} required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Subscription (months)</label>
                <input className={inputCls} type="number" min="1" max="36" value={form.subscription_months} onChange={set('subscription_months')} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Shop Type</label>
                <select className={inputCls} value={form.shop_type} onChange={set('shop_type')}>
                  <option value="retail">Retail / General</option>
                  <option value="car_wash">Car Service</option>
                  <option value="clothing">Clothing Shop</option>
                  <option value="grocery">Grocery / Supermarket</option>
                  <option value="restaurant">Restaurant / Cafe</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="bc" className="w-4 h-4 rounded accent-primary-600" checked={form.barcode_enabled} onChange={set('barcode_enabled')} />
                <label htmlFor="bc" className="text-sm text-gray-300 cursor-pointer">Enable barcode scanner</label>
              </div>
            </div>
          </div>
          <button type="submit" disabled={busy}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {busy ? 'Creating…' : 'Create Shop'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Shop Control Center (5-tab modal) ─────────────────────────
function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none
        ${enabled ? 'bg-green-500' : 'bg-gray-600'}`}
    >
      <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform
        ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function ShopControlCenter({ shop, onClose, onDone }) {
  const [activeTab, setActiveTab] = useState('info');
  const [busy,      setBusy]      = useState(false);

  // Info
  const [shopName,      setShopName]      = useState(shop.name         || '');
  const [ownerName,     setOwnerName]     = useState(shop.owner_name   || '');
  const [loginEmail,    setLoginEmail]    = useState(shop.email        || '');
  const [phone,         setPhone]         = useState(shop.phone        || '');
  const [address,       setAddress]       = useState(shop.address      || '');
  const [logoUrl,       setLogoUrl]       = useState(shop.logo_url     || '');
  const [contactEmail,  setContactEmail]  = useState(shop.contact_email || '');

  // Subscription
  const [months,          setMonths]          = useState('0');
  const [status,          setStatus]          = useState(shop.subscription_status || 'active');
  const [extraSlots,      setExtraSlots]      = useState(String(shop.extra_staff_slots || 0));
  const [gracePeriodDays, setGracePeriodDays] = useState(String(shop.grace_period_days || 5));
  const [defaultTaxRate,  setDefaultTaxRate]  = useState(String(shop.default_tax_rate  || 0));

  // Features
  const [shopType, setShopType] = useState(shop.shop_type || 'retail');
  const [flags, setFlags] = useState({
    barcode_enabled:              !!shop.barcode_enabled,
    pre_orders_enabled:           shop.pre_orders_enabled           !== false,
    customers_enabled:            shop.customers_enabled            !== false,
    reports_enabled:              shop.reports_enabled              !== false,
    analytics_enabled:            shop.analytics_enabled            !== false,
    loyalty_enabled:              shop.loyalty_enabled              !== false,
    refunds_enabled:              shop.refunds_enabled              !== false,
    void_enabled:                 shop.void_enabled                 !== false,
    offline_enabled:              shop.offline_enabled              !== false,
    exchanges_enabled:            shop.exchanges_enabled            !== false,
    branches_enabled:             shop.branches_enabled             !== false,
    car_service_products_enabled: shop.car_service_products_enabled !== false,
  });
  const toggleFlag = (key) => setFlags((p) => ({ ...p, [key]: !p[key] }));

  // Users
  const [users,       setUsers]       = useState([]);
  const [loadingUsers,setLoadingUsers]= useState(false);
  const [changingPw,  setChangingPw]  = useState({});
  const [addUserForm, setAddUserForm] = useState(null);

  // Danger Zone
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting,          setDeleting]          = useState(false);

  // Agent Info
  const [agentInfo,        setAgentInfo]        = useState(null);
  const [loadingAgentInfo, setLoadingAgentInfo] = useState(false);

  const inputCls = 'w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

  useEffect(() => {
    if (activeTab !== 'agent') return;
    setLoadingAgentInfo(true);
    adminApi.getShopAgentInfo(shop.id)
      .then(({ data }) => setAgentInfo(data))
      .catch(() => toast.error('Failed to load agent info'))
      .finally(() => setLoadingAgentInfo(false));
  }, [activeTab, shop.id]);

  useEffect(() => {
    if (activeTab !== 'users') return;
    setLoadingUsers(true);
    adminApi.getShopUsers(shop.id)
      .then(({ data }) => setUsers(data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoadingUsers(false));
  }, [activeTab, shop.id]);

  async function handleSave() {
    if (!shopName.trim()) return toast.error('Shop name is required');
    setBusy(true);
    try {
      await adminApi.updateSub(shop.id, {
        subscription_status: status,
        extend_months: parseInt(months, 10) || 0,
      });
      await adminApi.updateShop(shop.id, {
        name: shopName, owner_name: ownerName,
        email: loginEmail, phone, address,
        logo_url: logoUrl, contact_email: contactEmail,
        shop_type: shopType,
        barcode_enabled:    flags.barcode_enabled,
        pre_orders_enabled: flags.pre_orders_enabled,
        customers_enabled:  flags.customers_enabled,
        reports_enabled:    flags.reports_enabled,
        analytics_enabled:  flags.analytics_enabled,
        loyalty_enabled:    flags.loyalty_enabled,
        refunds_enabled:    flags.refunds_enabled,
        void_enabled:       flags.void_enabled,
        offline_enabled:    flags.offline_enabled,
        exchanges_enabled:            flags.exchanges_enabled,
        branches_enabled:             flags.branches_enabled,
        car_service_products_enabled: flags.car_service_products_enabled,
        extra_staff_slots:  parseInt(extraSlots, 10)      || 0,
        default_tax_rate:   parseFloat(defaultTaxRate)    || 0,
        grace_period_days:  parseInt(gracePeriodDays, 10) || 5,
      });
      toast.success('Shop updated');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddUser(e) {
    e.preventDefault();
    const { username, password, role } = addUserForm;
    if (!username || !password) return toast.error('Username and password are required');
    setBusy(true);
    try {
      const { data } = await adminApi.addShopUser(shop.id, { username, password, role });
      setUsers((prev) => [...prev, data]);
      setAddUserForm(null);
      toast.success('User added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add user');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteUser(userId, username) {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await adminApi.deleteShopUser(shop.id, userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success('User deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  }

  function openPw(userId) {
    setChangingPw((prev) => ({ ...prev, [userId]: { open: true, pw: '', busy: false } }));
  }
  function setPwVal(userId, val) {
    setChangingPw((prev) => ({ ...prev, [userId]: { ...prev[userId], pw: val } }));
  }
  async function savePw(userId) {
    const entry = changingPw[userId];
    if (!entry?.pw || entry.pw.length < 4) return toast.error('Min 4 characters');
    setChangingPw((prev) => ({ ...prev, [userId]: { ...prev[userId], busy: true } }));
    try {
      await adminApi.changeUserPw(shop.id, userId, entry.pw);
      toast.success('Password changed');
      setChangingPw((prev) => ({ ...prev, [userId]: { open: false, pw: '', busy: false } }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
      setChangingPw((prev) => ({ ...prev, [userId]: { ...prev[userId], busy: false } }));
    }
  }

  async function handleDeleteShop() {
    if (deleteConfirmName !== shop.name) return toast.error('Shop name does not match');
    setDeleting(true);
    try {
      await adminApi.deleteShop(shop.id);
      toast.success('Shop deleted');
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete shop');
      setDeleting(false);
    }
  }

  const ROLE_CLS = {
    owner:   'bg-yellow-900/40 text-yellow-300',
    manager: 'bg-blue-900/40 text-blue-300',
    cashier: 'bg-gray-700 text-gray-300',
  };

  function FeatureRow({ label, flagKey, note }) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-gray-700/40 last:border-0">
        <div>
          <p className="text-sm text-white">{label}</p>
          {note && <p className="text-xs text-gray-500">{note}</p>}
        </div>
        <ToggleSwitch enabled={flags[flagKey]} onToggle={() => toggleFlag(flagKey)} />
      </div>
    );
  }

  const TABS = [
    { id: 'info',         label: 'Info'         },
    { id: 'subscription', label: 'Subscription' },
    { id: 'features',     label: 'Features'     },
    { id: 'users',        label: 'Users'        },
    { id: 'agent',        label: 'Agent'        },
    { id: 'danger',       label: 'Danger'       },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <div>
            <p className="font-semibold text-white">Shop Control Center</p>
            <p className="text-xs text-gray-400 mt-0.5">{shop.name} · ID {shop.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 px-4 pt-3 border-b border-gray-700 shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors
                ${activeTab === t.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'}
                ${t.id === 'danger' ? 'text-red-400 hover:text-red-300' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">

          {/* ── Info ── */}
          {activeTab === 'info' && (
            <div className="space-y-3">
              {[
                ['Shop Name *',   shopName,     setShopName,     'text' ],
                ['Owner Name',    ownerName,    setOwnerName,    'text' ],
                ['Login Email *', loginEmail,   setLoginEmail,   'email'],
                ['Phone',         phone,        setPhone,        'text' ],
                ['Contact Email', contactEmail, setContactEmail, 'email'],
                ['Address',       address,      setAddress,      'text' ],
                ['Logo URL',      logoUrl,      setLogoUrl,      'text' ],
              ].map(([label, val, set, type]) => (
                <div key={label}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input className={inputCls} type={type} value={val}
                         onChange={(e) => set(e.target.value)} />
                </div>
              ))}
              {logoUrl && (
                <div className="bg-white rounded-lg p-2 flex items-center justify-center mt-1">
                  <img src={logoUrl} alt="logo" className="max-h-12 max-w-full object-contain" />
                </div>
              )}
            </div>
          )}

          {/* ── Subscription ── */}
          {activeTab === 'subscription' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Add Months (0 = status change only)</label>
                <input className={inputCls} type="number" min="0" max="36" value={months}
                       onChange={(e) => setMonths(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">
                  Current expiry: {shop.subscription_end_date
                    ? new Date(shop.subscription_end_date).toLocaleDateString() : 'none'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Extra Staff Slots</label>
                  <input className={inputCls} type="number" min="0" max="20" value={extraSlots}
                         onChange={(e) => setExtraSlots(e.target.value)} />
                  <p className="text-xs text-gray-500 mt-1">+1 manager & +1 cashier per slot</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Default Tax Rate (%)</label>
                  <input className={inputCls} type="number" min="0" max="100" step="0.01" value={defaultTaxRate}
                         onChange={(e) => setDefaultTaxRate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Grace Period (days after expiry)</label>
                <input className={inputCls} type="number" min="1" max="30" value={gracePeriodDays}
                       onChange={(e) => setGracePeriodDays(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">System default: 5. POS works during grace period.</p>
              </div>
            </div>
          )}

          {/* ── Features ── */}
          {activeTab === 'features' && (
            <div className="space-y-4">
              <div className="bg-gray-900/50 rounded-xl p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">System</p>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Shop Type</label>
                  <select className={inputCls} value={shopType} onChange={(e) => setShopType(e.target.value)}>
                    <option value="retail">Retail / General</option>
                    <option value="car_wash">Car Service</option>
                    <option value="clothing">Clothing Shop</option>
                    <option value="grocery">Grocery / Supermarket</option>
                    <option value="restaurant">Restaurant / Cafe</option>
                  </select>
                </div>
                <div className="mt-2">
                  <FeatureRow label="Barcode Scanner" flagKey="barcode_enabled" note="Hardware/camera barcode at POS" />
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">POS Core</p>
                <FeatureRow label="Allow Refunds"  flagKey="refunds_enabled"  note="Partial/full refund in Transactions" />
                <FeatureRow label="Allow Void"     flagKey="void_enabled"     note="Void completed transactions" />
                <FeatureRow label="Offline Mode"   flagKey="offline_enabled"  note="Accept sales offline and sync later" />
              </div>

              <div className="bg-gray-900/50 rounded-xl p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Modules</p>
                <FeatureRow label="Pre-Orders"     flagKey="pre_orders_enabled" note="Customer online ordering portal" />
                <FeatureRow label="Customers Tab"  flagKey="customers_enabled"  note="Customer insights dashboard" />
                <FeatureRow label="Loyalty Points" flagKey="loyalty_enabled"    note="Earn & redeem points at checkout" />
                <FeatureRow label="Reports"        flagKey="reports_enabled"    note="Sales & inventory report exports" />
                <FeatureRow label="Analytics"      flagKey="analytics_enabled"  note="Analytics charts and trends" />
              </div>

              <div className="bg-gray-900/50 rounded-xl p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Clothing Shops Only</p>
                <p className="text-xs text-gray-600 mb-2">Only apply when shop type is "Clothing"</p>
                <FeatureRow label="Exchanges / Returns" flagKey="exchanges_enabled" note="Single-transaction exchange module" />
                <FeatureRow label="Multi-Branch"        flagKey="branches_enabled"  note="Branch inventory management" />
              </div>

              <div className="bg-gray-900/50 rounded-xl p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Car Service Only</p>
                <p className="text-xs text-gray-600 mb-2">Only apply when shop type is "Car Service"</p>
                <FeatureRow label="Products / Add-ons" flagKey="car_service_products_enabled" note="Show products tab in Car Service module" />
              </div>
            </div>
          )}

          {/* ── Users ── */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {shop.extra_staff_slots > 0 ? `Extra slots: +${shop.extra_staff_slots}` : 'Default: 1 manager + 1 cashier'}
                </p>
                {!addUserForm && (
                  <button
                    onClick={() => setAddUserForm({ username: '', password: '', role: 'cashier' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Add User
                  </button>
                )}
              </div>

              {addUserForm && (
                <form onSubmit={handleAddUser} className="bg-gray-900 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-gray-400 font-medium mb-2">New User</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input placeholder="Username" required
                           className="bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                           value={addUserForm.username}
                           onChange={(e) => setAddUserForm((p) => ({ ...p, username: e.target.value }))} />
                    <input placeholder="Password" type="password" required
                           className="bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                           value={addUserForm.password}
                           onChange={(e) => setAddUserForm((p) => ({ ...p, password: e.target.value }))} />
                    <select className="bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-2 py-2 focus:outline-none"
                            value={addUserForm.role}
                            onChange={(e) => setAddUserForm((p) => ({ ...p, role: e.target.value }))}>
                      <option value="cashier">Cashier</option>
                      <option value="manager">Manager</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy}
                            className="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50">
                      {busy ? 'Adding…' : 'Add'}
                    </button>
                    <button type="button" onClick={() => setAddUserForm(null)}
                            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {loadingUsers && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}
              {!loadingUsers && users.length === 0 && (
                <p className="text-center py-6 text-gray-500 text-sm">No users found</p>
              )}
              {!loadingUsers && users.map((u) => {
                const cp = changingPw[u.id] || {};
                return (
                  <div key={u.id} className="bg-gray-900 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.username}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${ROLE_CLS[u.role] || ROLE_CLS.cashier}`}>
                          {u.role}
                        </span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {!cp.open && (
                          <button onClick={() => openPw(u.id)}
                                  className="flex items-center gap-1 px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">
                            <KeyRound className="w-3 h-3" /> PW
                          </button>
                        )}
                        <button onClick={() => handleDeleteUser(u.id, u.username)}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded-lg">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {cp.open && (
                      <div className="flex items-center gap-2">
                        <input type="password" placeholder="New password (min 4)"
                               className="flex-1 bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                               value={cp.pw}
                               onChange={(e) => setPwVal(u.id, e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && savePw(u.id)}
                               autoFocus />
                        <button onClick={() => savePw(u.id)} disabled={cp.busy}
                                className="px-3 py-2 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50">
                          {cp.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                        </button>
                        <button onClick={() => setChangingPw((p) => ({ ...p, [u.id]: { open: false } }))}
                                className="px-2 py-2 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Agent / Onboarded By ── */}
          {activeTab === 'agent' && (
            <div className="space-y-4">
              {loadingAgentInfo && (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              )}

              {!loadingAgentInfo && agentInfo && (
                <>
                  {agentInfo.agent_id ? (
                    <div className="bg-gray-900/60 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="w-4 h-4 text-primary-400" />
                        <p className="text-sm font-semibold text-white">Onboarded By</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-0.5">Agent Name</p>
                          <p className="text-sm font-medium text-white">{agentInfo.agent_name || '—'}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-0.5">Agent ID</p>
                          <p className="text-sm font-medium text-white">#{agentInfo.agent_id}</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3 flex items-start gap-2">
                          <Mail className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500 mb-0.5">Email</p>
                            <p className="text-sm text-white truncate">{agentInfo.agent_email || '—'}</p>
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3 flex items-start gap-2">
                          <Phone className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                            <p className="text-sm text-white">{agentInfo.agent_phone || '—'}</p>
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3 flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">District</p>
                            <p className="text-sm text-white capitalize">{agentInfo.agent_district || '—'}</p>
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-0.5">Onboarded On</p>
                          <p className="text-sm text-white">{fmtDate(agentInfo.onboarded_at)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          agentInfo.approval_status === 'approved'
                            ? 'bg-green-900/40 text-green-300'
                            : agentInfo.approval_status === 'pending'
                            ? 'bg-yellow-900/40 text-yellow-300'
                            : 'bg-red-900/40 text-red-300'
                        }`}>
                          Agent: {agentInfo.approval_status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          agentInfo.agent_is_active ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-400'
                        }`}>
                          {agentInfo.agent_is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      This shop was not onboarded through an agent.
                    </div>
                  )}

                  {/* Commission records */}
                  {agentInfo.commissions && agentInfo.commissions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-primary-400" />
                        <p className="text-sm font-semibold text-white">Commission Records</p>
                      </div>
                      <div className="overflow-x-auto rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="bg-gray-900/80 text-gray-500">
                              <th className="px-3 py-2 font-medium">Type</th>
                              <th className="px-3 py-2 font-medium">Amount</th>
                              <th className="px-3 py-2 font-medium">Month</th>
                              <th className="px-3 py-2 font-medium">Status</th>
                              <th className="px-3 py-2 font-medium">Paid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agentInfo.commissions.map((c) => (
                              <tr key={c.id} className="border-t border-gray-700/50 hover:bg-gray-700/20">
                                <td className="px-3 py-2 text-gray-300 capitalize">{c.commission_type?.replace(/_/g, ' ') || '—'}</td>
                                <td className="px-3 py-2 text-white font-medium">LKR {fmtMoney(c.amount)}</td>
                                <td className="px-3 py-2 text-gray-400">{c.month || '—'}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                                    c.status === 'paid'     ? 'bg-green-900/40 text-green-300' :
                                    c.status === 'approved' ? 'bg-blue-900/40 text-blue-300'  :
                                    c.status === 'locked'   ? 'bg-gray-700 text-gray-400'      :
                                                              'bg-yellow-900/40 text-yellow-300'
                                  }`}>
                                    {c.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-400">{c.paid_at ? fmtDate(c.paid_at) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {agentInfo.agent_id && (!agentInfo.commissions || agentInfo.commissions.length === 0) && (
                    <p className="text-center text-gray-500 text-xs py-2">No commission records for this shop yet.</p>
                  )}
                </>
              )}

              {!loadingAgentInfo && !agentInfo && (
                <p className="text-center text-gray-500 text-sm py-8">Failed to load agent info.</p>
              )}
            </div>
          )}

          {/* ── Danger Zone ── */}
          {activeTab === 'danger' && (
            <div className="space-y-4">
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
                <p className="text-sm font-semibold text-yellow-300 mb-1">Suspend Shop</p>
                <p className="text-xs text-gray-400 mb-3">Sets status to "suspended" — staff cannot log in.</p>
                <button
                  onClick={async () => {
                    if (!window.confirm('Suspend this shop?')) return;
                    try {
                      await adminApi.updateSub(shop.id, { subscription_status: 'suspended' });
                      toast.success('Shop suspended');
                      onDone();
                    } catch (err) {
                      toast.error(err.response?.data?.error || 'Failed');
                    }
                  }}
                  className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg"
                >
                  Suspend Shop
                </button>
              </div>

              <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <p className="text-sm font-semibold text-red-400">Delete Shop Permanently</p>
                </div>
                <p className="text-xs text-gray-400">
                  Removes all users, products, transactions, and orders.
                  <span className="font-bold text-red-400"> This cannot be undone.</span>
                </p>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Type <span className="font-mono text-gray-200">{shop.name}</span> to confirm
                  </label>
                  <input
                    className="w-full bg-gray-900 border border-red-700/50 text-white text-sm rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600"
                    placeholder="Shop name…"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleDeleteShop}
                  disabled={deleting || deleteConfirmName !== shop.name}
                  className="w-full py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-lg
                             disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Deleting…' : 'Delete Shop Permanently'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer save — hidden on Users and Danger tabs */}
        {!['users', 'agent', 'danger'].includes(activeTab) && (
          <div className="flex gap-2 px-5 py-3 border-t border-gray-700 shrink-0">
            <button onClick={onClose}
                    className="flex-1 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">
              Cancel
            </button>
            <button onClick={handleSave} disabled={busy}
                    className="flex-1 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg
                               hover:bg-primary-700 flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



// ── Analysis Tab ──────────────────────────────────────────────
function AnalysisTab({ shops }) {
  const today     = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate,   setEndDate]   = useState(today);
  const [shopId,    setShopId]    = useState('');
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);

  const fmt   = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const fmtN  = (n) => Number(n || 0).toLocaleString();

  function setPreset(preset) {
    const now = new Date();
    if (preset === 'today') {
      setStartDate(today); setEndDate(today);
    } else if (preset === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      setStartDate(d.toISOString().slice(0, 10)); setEndDate(today);
    } else if (preset === 'month') {
      setStartDate(monthStart); setEndDate(today);
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(last.toISOString().slice(0, 10));
    }
  }

  async function load() {
    setLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      if (shopId) params.shop_id = shopId;
      const { data: res } = await adminApi.getAnalysis(params);
      setData(res);
    } catch {
      toast.error('Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }

  // auto-load on mount
  useEffect(() => { load(); }, []); // eslint-disable-line

  const profitColor = (n) => Number(n) >= 0 ? 'text-green-400' : 'text-red-400';

  const inputCls = 'bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-5">
      {/* ── Filters ── */}
      <div className="bg-gray-800 rounded-xl p-4 space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Filters</p>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Today',      key: 'today'      },
            { label: 'This Week',  key: 'week'       },
            { label: 'This Month', key: 'month'      },
            { label: 'Last Month', key: 'last_month' },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">From</label>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To</label>
            <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Shop</label>
            <select className={inputCls} value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">All Shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700
                       text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <BarChart2 className="w-4 h-4" />}
            {loading ? 'Loading…' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {!data && !loading && (
        <div className="text-center py-16 text-gray-500">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Select a date range and click Run Analysis</p>
        </div>
      )}

      {loading && !data && (
        <div className="flex justify-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {data && (
        <>
          {/* ── Overview cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Revenue</p>
                <p className="text-xl font-bold text-white">{fmt(data.total_revenue)}</p>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Cost (COGS)</p>
                <p className="text-xl font-bold text-white">{fmt(data.total_cost)}</p>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${data.total_profit >= 0 ? 'bg-green-600' : 'bg-red-600'}`}>
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Gross Profit</p>
                <p className={`text-xl font-bold ${profitColor(data.total_profit)}`}>{fmt(data.total_profit)}</p>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Transactions</p>
                <p className="text-xl font-bold text-white">{fmtN(data.transaction_count)}</p>
              </div>
            </div>
          </div>

          {/* Profit margin badge */}
          {data.total_revenue > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Profit Margin:</span>
              <span className={`text-sm font-bold ${profitColor(data.total_profit)}`}>
                {((data.total_profit / data.total_revenue) * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {/* ── Top Products ── */}
          {data.top_products?.length > 0 && (
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-semibold text-white">Top Products by Revenue</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-700">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-right px-4 py-3">Qty Sold</th>
                      <th className="text-right px-4 py-3">Revenue</th>
                      <th className="text-right px-4 py-3">Cost</th>
                      <th className="text-right px-4 py-3">Profit</th>
                      <th className="text-right px-4 py-3">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {data.top_products.map((p, i) => {
                      const margin = Number(p.revenue) > 0
                        ? ((Number(p.profit) / Number(p.revenue)) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr key={i} className="hover:bg-gray-750 transition-colors">
                          <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                          <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{fmtN(p.qty_sold)}</td>
                          <td className="px-4 py-3 text-right text-white">{fmt(p.revenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-400">{fmt(p.cost)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${profitColor(p.profit)}`}>{fmt(p.profit)}</td>
                          <td className={`px-4 py-3 text-right text-xs ${profitColor(p.profit)}`}>{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Shop Breakdown (all-shops view) ── */}
          {data.shop_breakdown?.length > 0 && (
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
                <Store className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-semibold text-white">Revenue by Shop</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-700">
                      <th className="text-left px-4 py-3">Shop</th>
                      <th className="text-right px-4 py-3">Transactions</th>
                      <th className="text-right px-4 py-3">Revenue</th>
                      <th className="text-right px-4 py-3">Cost</th>
                      <th className="text-right px-4 py-3">Profit</th>
                      <th className="text-right px-4 py-3">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {data.shop_breakdown.map((s) => {
                      const margin = Number(s.revenue) > 0
                        ? ((Number(s.profit) / Number(s.revenue)) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr key={s.shop_id} className="hover:bg-gray-750 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">{s.shop_name}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{fmtN(s.transaction_count)}</td>
                          <td className="px-4 py-3 text-right text-white">{fmt(s.revenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-400">{fmt(s.cost)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${profitColor(s.profit)}`}>{fmt(s.profit)}</td>
                          <td className={`px-4 py-3 text-right text-xs ${profitColor(s.profit)}`}>{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.top_products?.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>No sales data for the selected period</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const AUDIT_TYPE_LABELS = {
  product:          'Product Deleted',
  transaction_void: 'Transaction Voided',
};

function AuditRow({ record: r, preview }) {
  const [open, setOpen] = useState(false);
  const typeLabel = AUDIT_TYPE_LABELS[r.record_type] || r.record_type;
  const dateStr   = r.deleted_at
    ? new Date(r.deleted_at).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '-';

  return (
    <>
      <tr className="hover:bg-gray-750 transition-colors">
        <td className="px-4 py-3 text-gray-300">{r.shop_name || '-'}</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full
            ${r.record_type === 'product'
              ? 'bg-red-900/50 text-red-300'
              : 'bg-orange-900/50 text-orange-300'}`}>
            {typeLabel}
          </span>
        </td>
        <td className="px-4 py-3 text-white font-medium">{preview}</td>
        <td className="px-4 py-3 text-gray-400">{r.deleted_by || '-'}</td>
        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{dateStr}</td>
        <td className="px-4 py-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {open ? 'Hide' : 'Show'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-900/50">
          <td colSpan={6} className="px-4 py-3">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {JSON.stringify(r.original_data, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Financial Summary Tab ─────────────────────────────────────
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function FinancialTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.financialSummary()
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error('Failed to load financial summary'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />)}
    </div>
  );
  if (!data) return null;

  const rev   = data.revenue   || {};
  const subs  = data.subscriptions || {};
  const agents = data.agents   || [];
  const monthly = (data.monthly || []).map((m) => ({
    month:     m.month,
    collected: Number(m.collected),
    count:     Number(m.payment_count),
  }));

  const metricCard = (label, value, sub, color) => (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metricCard('Total Collected',    `LKR ${fmtMoney(rev.total_collected)}`,   `${rev.pending_count} pending`, 'text-green-400')}
        {metricCard('Pending Verification', `LKR ${fmtMoney(rev.pending_amount)}`,   `awaiting admin review`, 'text-yellow-400')}
        {metricCard('Partial Payment Shortage', `LKR ${fmtMoney(rev.total_shortage)}`, `${rev.partial_count} partial submission(s)`, 'text-red-400')}
        {metricCard('Active Shops',        subs.active,   `${subs.expiring_7d} expiring in 7d`, 'text-blue-400')}
        {metricCard('Expiring (30d)',       subs.expiring_30d, `${subs.expired} already expired`, 'text-orange-400')}
        {metricCard('Suspicious Payments', rev.suspicious_count, 'flagged for review', 'text-red-400')}
      </div>

      {/* Monthly collection bar chart */}
      {monthly.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-4">Monthly Collection (Verified)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly}>
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v) => [`LKR ${Number(v).toLocaleString()}`, 'Collected']}
              />
              <Bar dataKey="collected" fill="#6366f1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Subscription breakdown */}
      <div className="bg-gray-800 rounded-xl p-5">
        <p className="text-sm font-semibold text-white mb-3">Subscription Status</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          {[
            { label: 'Active',          value: subs.active,          cls: 'text-green-400' },
            { label: 'Trial',           value: subs.trial,           cls: 'text-blue-400'  },
            { label: 'Pending Payment', value: subs.pending_payment, cls: 'text-yellow-400'},
            { label: 'Expired',         value: subs.expired,         cls: 'text-red-400'   },
            { label: 'Expiring 7d',     value: subs.expiring_7d,     cls: 'text-orange-400'},
          ].map((s) => (
            <div key={s.label} className="bg-gray-700 rounded-lg p-3">
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Agent performance table */}
      <div className="bg-gray-800 rounded-xl p-5 overflow-x-auto">
        <p className="text-sm font-semibold text-white mb-3">Agent Performance</p>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-2">Agent</th>
              <th className="pb-2 text-right">Shops</th>
              <th className="pb-2 text-right">Verified Payments</th>
              <th className="pb-2 text-right">Suspicious</th>
              <th className="pb-2 text-right">Collected</th>
              <th className="pb-2 text-right">Commission</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2">
                  <p className="font-medium text-white">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.email}</p>
                </td>
                <td className="py-2 text-right text-gray-300">{a.shops_onboarded}</td>
                <td className="py-2 text-right text-green-400">{a.verified_payments}</td>
                <td className="py-2 text-right">
                  <span className={Number(a.suspicious_payments) > 0 ? 'text-red-400 font-semibold' : 'text-gray-500'}>
                    {a.suspicious_payments}
                  </span>
                </td>
                <td className="py-2 text-right text-white">LKR {fmtMoney(a.total_verified_amount)}</td>
                <td className="py-2 text-right text-indigo-400">LKR {fmtMoney(a.total_commission)}</td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">No agent data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Dashboard Overview Tab ────────────────────────────────────
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function DashboardTab({ stats }) {
  if (!stats) return null;

  const monthlyData = (stats.monthly_revenue || []).map((r) => ({
    month:   r.month,
    revenue: Number(r.revenue),
    count:   Number(r.payment_count),
  }));

  const pieData = (stats.plan_distribution || []).map((r) => ({
    name:  r.plan,
    value: Number(r.count),
  }));

  return (
    <div className="space-y-6">
      {/* Extra stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Trial Shops</p>
            <p className="text-2xl font-bold text-white">{stats.trial_shops}</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Expired Shops</p>
            <p className="text-2xl font-bold text-white">{stats.expired_shops}</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400">New Shops (7d)</p>
            <p className="text-2xl font-bold text-white">{stats.new_shops_7d}</p>
          </div>
        </div>
      </div>

      {/* Monthly revenue chart */}
      {monthlyData.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-white mb-4">Monthly Revenue (last 6 months)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false} tickLine={false} width={60}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(v) => [`Rs ${Number(v).toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Plan distribution */}
      {pieData.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-white mb-4">Active Subscriptions by Plan</p>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                  formatter={(v, name) => [v, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 shrink-0">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-sm text-gray-300">{d.name}</span>
                  <span className="text-sm font-bold text-white ml-2">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {monthlyData.length === 0 && pieData.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <BarChart2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p>No subscription data yet</p>
        </div>
      )}
    </div>
  );
}

// ── Plans Tab ─────────────────────────────────────────────────
function PlanModal({ plan, onClose, onSaved }) {
  const isEdit = !!plan?.id;
  const empty = {
    name: '', base_monthly_price: '',
    discount_3m: '10', discount_6m: '15', discount_12m: '20',
    features: '', max_products: '', max_staff: '',
    sort_order: '0', is_active: true,
  };
  const [form, setForm] = useState(() => {
    if (!isEdit) return empty;
    const lims = plan.limits || {};
    return {
      name:              plan.name,
      base_monthly_price: String(plan.base_monthly_price),
      discount_3m:       String(Math.round(Number(plan.discount_3m)  * 100)),
      discount_6m:       String(Math.round(Number(plan.discount_6m)  * 100)),
      discount_12m:      String(Math.round(Number(plan.discount_12m) * 100)),
      features:          Array.isArray(plan.features) ? plan.features.join('\n') : '',
      max_products:      lims.max_products != null ? String(lims.max_products) : '',
      max_staff:         lims.max_staff    != null ? String(lims.max_staff)    : '',
      sort_order:        String(plan.sort_order ?? 0),
      is_active:         plan.is_active !== false,
    };
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [k]: v }));
  };

  const inputCls = 'w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const featureList = form.features.split('\n').map((s) => s.trim()).filter(Boolean);
      const limits = {};
      if (form.max_products !== '') limits.max_products = parseInt(form.max_products, 10);
      if (form.max_staff    !== '') limits.max_staff    = parseInt(form.max_staff,    10);
      const payload = {
        name:               form.name,
        base_monthly_price: Number(form.base_monthly_price),
        discount_3m:        Number(form.discount_3m)  / 100,
        discount_6m:        Number(form.discount_6m)  / 100,
        discount_12m:       Number(form.discount_12m) / 100,
        features:           featureList,
        limits,
        sort_order:         parseInt(form.sort_order, 10) || 0,
        is_active:          form.is_active,
      };
      if (isEdit) {
        await adminApi.updatePlan(plan.id, payload);
        toast.success('Plan updated');
      } else {
        await adminApi.createPlan(payload);
        toast.success('Plan created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save plan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <p className="font-semibold text-white">{isEdit ? 'Edit Plan' : 'Create Plan'}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Plan Name *</label>
              <input className={inputCls} value={form.name} onChange={set('name')} required placeholder="e.g. Basic" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Monthly Price (Rs) *</label>
              <input className={inputCls} type="number" min="0" value={form.base_monthly_price} onChange={set('base_monthly_price')} required />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Sort Order</label>
              <input className={inputCls} type="number" min="0" value={form.sort_order} onChange={set('sort_order')} />
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Discounts</p>
            <div className="grid grid-cols-3 gap-3">
              {[['3 Month %', 'discount_3m'], ['6 Month %', 'discount_6m'], ['12 Month %', 'discount_12m']].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input className={inputCls} type="number" min="0" max="100" value={form[key]} onChange={set(key)} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Limits</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Max Products (-1 = unlimited)</label>
                <input className={inputCls} type="number" min="-1" value={form.max_products} onChange={set('max_products')} placeholder="-1" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Max Staff (-1 = unlimited)</label>
                <input className={inputCls} type="number" min="-1" value={form.max_staff} onChange={set('max_staff')} placeholder="-1" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Features (one per line)</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={6}
              value={form.features}
              onChange={set('features')}
              placeholder="POS Core&#10;Products (up to 100)&#10;1 Staff Account"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-white">Plan Active</p>
              <p className="text-xs text-gray-500">Inactive plans won't be shown to customers</p>
            </div>
            <button type="button" onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}>
              {form.is_active
                ? <ToggleRight className="w-8 h-8 text-green-400" />
                : <ToggleLeft  className="w-8 h-8 text-gray-600" />}
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
                    className="flex-1 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={busy}
                    className="flex-1 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg
                               hover:bg-primary-700 flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {busy ? 'Saving…' : (isEdit ? 'Update Plan' : 'Create Plan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PlansTab() {
  const [plans,    setPlans]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editPlan, setEditPlan] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await adminApi.getPlans();
      setPlans(data);
    } catch {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(plan) {
    if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    try {
      await adminApi.deletePlan(plan.id);
      toast.success('Plan deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Manage subscription tiers shown to customers in the Billing page.</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700
                     text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && plans.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Layers className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p>No plans yet. Create your first plan above.</p>
        </div>
      )}

      {!loading && plans.map((p) => {
        const featureList = Array.isArray(p.features) ? p.features : [];
        const lims = p.limits || {};
        return (
          <div key={p.id} className="bg-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-white text-lg">{p.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${p.is_active ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-2xl font-bold text-primary-400 mt-1">
                  Rs {Number(p.base_monthly_price).toLocaleString()}
                  <span className="text-sm font-normal text-gray-400">/mo</span>
                </p>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  <span>3m: {Math.round(Number(p.discount_3m) * 100)}% off</span>
                  <span>6m: {Math.round(Number(p.discount_6m) * 100)}% off</span>
                  <span>12m: {Math.round(Number(p.discount_12m) * 100)}% off</span>
                </div>
                {(lims.max_products != null || lims.max_staff != null) && (
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    {lims.max_products != null && (
                      <span>Products: {lims.max_products === -1 ? 'Unlimited' : lims.max_products}</span>
                    )}
                    {lims.max_staff != null && (
                      <span>Staff: {lims.max_staff === -1 ? 'Unlimited' : lims.max_staff}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditPlan(p)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-700
                                   hover:bg-gray-600 text-gray-300 rounded-lg">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => handleDelete(p)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-900/40
                                   hover:bg-red-900/70 text-red-400 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {featureList.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {featureList.map((f, i) => (
                  <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showCreate && (
        <PlanModal
          plan={null}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
      {editPlan && (
        <PlanModal
          plan={editPlan}
          onClose={() => setEditPlan(null)}
          onSaved={() => { setEditPlan(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────
function NotificationsTab({ shops }) {
  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');
  const [target,   setTarget]   = useState('all');
  const [shopId,   setShopId]   = useState('');
  const [busy,     setBusy]     = useState(false);
  const [result,   setResult]   = useState(null);

  const inputCls = 'w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

  async function handleSend(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return toast.error('Title and body are required');
    if (target === 'specific' && !shopId) return toast.error('Select a shop');
    setBusy(true);
    setResult(null);
    try {
      const { data } = await adminApi.dispatchNotification({
        title: title.trim(), body: body.trim(),
        target,
        shop_id: target === 'specific' ? Number(shopId) : undefined,
      });
      setResult(data);
      toast.success(`Sent to ${data.sent} shop${data.sent !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send notification');
    } finally {
      setBusy(false);
    }
  }

  const targetOptions = [
    { value: 'all',      label: 'All Shops'      },
    { value: 'active',   label: 'Active Shops'   },
    { value: 'trial',    label: 'Trial Shops'    },
    { value: 'expired',  label: 'Expired Shops'  },
    { value: 'specific', label: 'Specific Shop'  },
  ];

  return (
    <div className="space-y-5 max-w-lg">
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-indigo-400" />
          <p className="text-sm font-semibold text-white">Dispatch Push Notification</p>
        </div>
        <p className="text-xs text-gray-400">
          Sends a push notification to shop owners via the mobile app.
          Shops must be subscribed to the <span className="font-mono text-gray-300">shop_&#123;id&#125;_alerts</span> topic.
        </p>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Target</label>
          <select className={inputCls} value={target} onChange={(e) => { setTarget(e.target.value); setShopId(''); }}>
            {targetOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {target === 'specific' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Shop *</label>
            <select className={inputCls} value={shopId} onChange={(e) => setShopId(e.target.value)} required>
              <option value="">— Select shop —</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name} (ID {s.id})</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-400 mb-1">Notification Title *</label>
          <input
            className={inputCls}
            placeholder="e.g. Subscription Expiring Soon"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Message *</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={4}
            placeholder="e.g. Your subscription expires in 3 days. Renew now to avoid interruption."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600
                     hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg
                     transition-colors disabled:opacity-50"
        >
          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {busy ? 'Sending…' : 'Send Notification'}
        </button>
      </form>

      {result && (
        <div className="bg-gray-800 rounded-xl p-4 space-y-1">
          <p className="text-sm font-semibold text-white">Result</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-400">Targeted: </span>
              <span className="font-bold text-white">{result.total}</span>
            </div>
            <div>
              <span className="text-gray-400">In-app: </span>
              <span className="font-bold text-green-400">{result.inapp_sent}</span>
            </div>
            {result.fcm_sent > 0 && (
              <div>
                <span className="text-gray-400">FCM push: </span>
                <span className="font-bold text-blue-400">{result.fcm_sent}</span>
              </div>
            )}
            {result.fcm_skipped > 0 && (
              <div>
                <span className="text-gray-400">FCM skipped: </span>
                <span className="font-bold text-yellow-400">{result.fcm_skipped}</span>
              </div>
            )}
            {result.fcm_failed > 0 && (
              <div>
                <span className="text-gray-400">FCM failed: </span>
                <span className="font-bold text-red-400">{result.fcm_failed}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent Payments Tab ────────────────────────────────────────
function AgentPaymentsTab({ payments, loading, onVerify, onReject }) {
  const [rejectNote, setRejectNote] = useState({});  // id → note string
  const [rejectOpen, setRejectOpen] = useState(null); // id being rejected

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>No pending agent payment submissions</p>
      </div>
    );
  }

  const DETAIL_BADGE = {
    full:        { label: 'Full Payment',  cls: 'bg-green-900 text-green-300'  },
    partial:     { label: 'Partial',       cls: 'bg-red-900   text-red-300'    },
    overpayment: { label: 'Overpayment',   cls: 'bg-blue-900  text-blue-300'   },
    mismatch:    { label: 'Mismatch',      cls: 'bg-red-900   text-red-300'    },
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        {payments.length} pending submission{payments.length !== 1 ? 's' : ''} — verifying activates the shop subscription
      </p>
      {payments.map((p) => {
        const submitted    = Number(p.submitted_amount || p.amount || 0);
        const expected     = p.expected_amount ? Number(p.expected_amount) : null;
        const shortage     = p.shortage_amount  ? Number(p.shortage_amount) : 0;
        const detailStatus = p.payment_detail_status;
        const detailBadge  = DETAIL_BADGE[detailStatus];
        return (
        <div key={p.id} className={`bg-gray-800 rounded-xl p-4 space-y-3 ${p.is_suspicious ? 'ring-2 ring-red-500' : ''}`}>
          {p.is_suspicious && (
            <div className="flex items-center gap-2 bg-red-900/40 border border-red-700 rounded-lg px-3 py-1.5 text-xs text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {p.flag_reason || 'Suspicious: submitted amount is significantly below expected'}
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{p.shop_name}</p>
              <p className="text-xs text-gray-400">Owner: {p.owner_name}</p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <p className={`text-sm font-bold ${p.is_suspicious ? 'text-red-400' : 'text-green-400'}`}>
                  LKR {submitted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                {expected && (
                  <p className="text-xs text-gray-500">
                    Expected: <span className={p.is_suspicious ? 'text-red-400' : 'text-gray-400'}>
                      LKR {expected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
                {shortage > 0 && (
                  <p className="text-xs text-red-400 font-medium">
                    Short: LKR {shortage.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                via {p.payment_method?.toUpperCase()} · {fmtDate(p.payment_date)}
                <span className="mx-1.5 text-gray-600">·</span>
                Agent: <span className="text-gray-300">{p.agent_name}</span>
              </p>
              {p.notes && (
                <p className="text-xs text-yellow-400 mt-1">Note: {p.notes}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800">
                Pending
              </span>
              {detailBadge && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${detailBadge.cls}`}>
                  {detailBadge.label}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onVerify(p.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                         bg-green-700 hover:bg-green-600 rounded-lg text-white transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Verify & Activate Shop
            </button>
            <button
              onClick={() => setRejectOpen(rejectOpen === p.id ? null : p.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                         bg-red-700 hover:bg-red-600 rounded-lg text-white transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </div>

          {rejectOpen === p.id && (
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                placeholder="Reason for rejection (optional)"
                value={rejectNote[p.id] || ''}
                onChange={(e) => setRejectNote((n) => ({ ...n, [p.id]: e.target.value }))}
                className="flex-1 bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-3 py-1.5
                           focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500"
              />
              <button
                onClick={() => {
                  onReject(p.id, rejectNote[p.id] || '');
                  setRejectOpen(null);
                }}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-xs font-semibold text-white"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

// ── Admin Notification Bell ───────────────────────────────────
const PRIORITY_COLOR = {
  critical: 'bg-red-900 border-red-700 text-red-300',
  high:     'bg-yellow-900 border-yellow-700 text-yellow-300',
  normal:   'bg-gray-800 border-gray-700 text-gray-300',
};
const PRIORITY_DOT = {
  critical: 'bg-red-400',
  high:     'bg-yellow-400',
  normal:   'bg-gray-400',
};

function AdminNotificationBell() {
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread,        setUnread]        = useState(0);
  const [loading,       setLoading]       = useState(false);
  const pollRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await adminApi.getAdminNotifications();
      setNotifications(data.notifications || []);
      setUnread(data.unread_count || 0);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    fetchNotifs();
    pollRef.current = setInterval(fetchNotifs, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchNotifs]);

  async function handleMarkAll() {
    setLoading(true);
    try {
      await adminApi.markAllAdminNotificationsRead();
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { toast.error('Failed to mark all as read'); }
    finally { setLoading(false); }
  }

  async function handleMarkOne(id) {
    try {
      await adminApi.markAdminNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch { /* silent */ }
  }

  const fmtAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        title="Admin notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={loading}
                className="text-xs text-primary-400 hover:text-primary-300 disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && handleMarkOne(n.id)}
                  className={`px-4 py-3 border-b border-gray-700/50 cursor-pointer hover:bg-gray-700/50 transition-colors
                              ${!n.is_read ? 'bg-gray-750' : 'opacity-60'}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[n.priority] || PRIORITY_DOT.normal}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{fmtAgo(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const logout   = useAdminStore((s) => s.logout);
  const navigate = useNavigate();

  const [tab,        setTab]        = useState('payments');
  const [stats,      setStats]      = useState(null);
  const [payments,   setPayments]   = useState([]);
  const [agentPayments, setAgentPayments] = useState([]);
  const [shops,      setShops]      = useState([]);
  const [auditLog,   setAuditLog]   = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage,  setAuditPage]  = useState(0);
  const [auditType,  setAuditType]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [proofPayId,    setProofPayId]    = useState(null);
  const [rejectPayId,   setRejectPayId]   = useState(null);
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [manageShop,    setManageShop]    = useState(null);
  const [shopSearch,    setShopSearch]    = useState('');
  const [shopStatusFilter, setShopStatusFilter] = useState('');

  const AUDIT_PAGE_SIZE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, payRes, shopRes, agentPayRes] = await Promise.all([
        adminApi.dashboard(),
        adminApi.listPayments(),
        adminApi.listShops(),
        adminApi.pendingAgentPayments(),
      ]);
      setStats(dashRes.data);
      setPayments(payRes.data);
      setShops(shopRes.data);
      setAgentPayments(agentPayRes.data);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/admin/login', { replace: true });
      } else {
        toast.error('Failed to load admin data');
      }
    } finally {
      setLoading(false);
    }
  }, [logout, navigate]);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const params = { limit: AUDIT_PAGE_SIZE, offset: auditPage * AUDIT_PAGE_SIZE };
      if (auditType) params.record_type = auditType;
      const { data } = await adminApi.getAuditLog(params);
      setAuditLog(data.records);
      setAuditTotal(data.total);
    } catch {
      toast.error('Failed to load audit log');
    } finally {
      setLoadingAudit(false);
    }
  }, [auditPage, auditType]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'audit') loadAudit(); }, [tab, loadAudit]);

  async function handleApprove(paymentId) {
    try {
      await adminApi.verifyPayment(paymentId);
      toast.success('Payment approved!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    }
  }

  async function handleVerifyAgentPayment(id) {
    try {
      await adminApi.verifyAgentPayment(id);
      toast.success('Agent payment verified — shop subscription activated!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to verify');
    }
  }

  async function handleRejectAgentPayment(id, note) {
    try {
      await adminApi.rejectAgentPayment(id, { admin_note: note });
      toast.success('Payment rejected');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject');
    }
  }

  function handleLogout() {
    logout();
    navigate('/admin/login', { replace: true });
  }

  const pendingCount      = payments.filter((p) => p.status === 'pending').length;
  const agentPendingCount = agentPayments.length;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top bar */}
      <div className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">Super Admin Panel</p>
            <p className="text-xs text-gray-400">POS SaaS Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <AdminNotificationBell />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-gray-700"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Shops"    value={stats.total_shops}    icon={Store}       color="bg-blue-600" />
            <StatCard label="Active"         value={stats.active_shops}   icon={CheckCircle2} color="bg-green-600" />
            <StatCard label="Pending Payments" value={stats.pending_payments} icon={Clock}   color="bg-yellow-600" />
            <StatCard label="Total Revenue"  value={`${fmtMoney(stats.total_revenue)}`} icon={CreditCard} color="bg-purple-600" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 rounded-xl p-1 w-fit flex-wrap">
          {[
            { id: 'payments',       label: 'Payments',        badge: pendingCount },
            { id: 'agent_payments', label: 'Agent Payments',  badge: agentPendingCount },
            { id: 'shops',          label: 'Shops'            },
            { id: 'financial',      label: 'Financials',    icon: DollarSign },
            { id: 'analysis',      label: 'Analysis',      icon: BarChart2 },
            { id: 'audit',         label: 'Audit Log'      },
            { id: 'dashboard_tab', label: 'Overview',      icon: TrendingUp },
            { id: 'plans',         label: 'Plans',         icon: Layers },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'agents',        label: 'Sales Agents',  icon: Users, isLink: '/admin/agents' },
          ].map((t) => (
            t.isLink ? (
              <a key={t.id} href={t.isLink}
                className="relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-gray-400 hover:text-white">
                {t.icon && <t.icon className="w-3.5 h-3.5" />}
                {t.label}
              </a>
            ) : (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${tab === t.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {t.icon && <t.icon className="w-3.5 h-3.5" />}
                {t.label}
                {t.badge > 0 && (
                  <span className="ml-1.5 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {t.badge}
                  </span>
                )}
              </button>
            )
          ))}
        </div>

        {/* Payments tab */}
        {tab === 'payments' && (
          <div className="space-y-3">
            {loading && [...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
            ))}
            {!loading && payments.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No payments yet</p>
              </div>
            )}
            {!loading && payments.map((p) => {
              const badge = PAY_STATUS[p.status] || PAY_STATUS.pending;
              return (
                <div key={p.id} className="bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">
                        {p.shop_name}
                        <span className="ml-2 text-gray-400 font-normal text-sm">({p.owner_name})</span>
                      </p>
                      <p className="text-sm text-gray-400">
                        {fmtMoney(p.amount)} - {p.subscription_months} month{p.subscription_months > 1 ? 's' : ''}
                        <span className="mx-2 text-gray-600">·</span>
                        {fmtDate(p.payment_date)}
                      </p>
                      {p.notes && (
                        <p className="text-xs text-red-400 mt-0.5">Note: {p.notes}</p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {p.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setProofPayId(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                                   bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Proof
                      </button>
                      <button
                        onClick={() => handleApprove(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                                   bg-green-700 hover:bg-green-600 rounded-lg text-white transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => setRejectPayId(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                                   bg-red-700 hover:bg-red-600 rounded-lg text-white transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                  {p.status !== 'pending' && p.payment_proof && (
                    <button
                      onClick={() => setProofPayId(p.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 w-fit"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Proof
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Agent Payments tab */}
        {tab === 'agent_payments' && (
          <AgentPaymentsTab
            payments={agentPayments}
            loading={loading}
            onVerify={handleVerifyAgentPayment}
            onReject={handleRejectAgentPayment}
          />
        )}

        {/* Shops tab */}
        {tab === 'shops' && (
          <div className="space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search shops…"
                  value={shopSearch}
                  onChange={(e) => setShopSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-8 pr-3 py-2
                             focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-500"
                />
              </div>
              <select
                value={shopStatusFilter}
                onChange={(e) => setShopStatusFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
              <button
                onClick={() => setShowCreateShop(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700
                           text-white text-sm font-medium rounded-lg transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Shop
              </button>
            </div>

            {loading && [...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
            ))}
            {!loading && shops.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Store className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No shops yet. Add your first shop above.</p>
              </div>
            )}
            {!loading && (() => {
              const q = shopSearch.toLowerCase();
              const filtered = shops.filter((s) => {
                const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.owner_name?.toLowerCase().includes(q);
                const matchStatus = !shopStatusFilter || s.subscription_status === shopStatusFilter;
                return matchSearch && matchStatus;
              });
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No shops match the current filter
                  </div>
                );
              }
              return filtered.map((s) => {
                const badge = SUB_STATUS[s.subscription_status] || SUB_STATUS.expired;
                return (
                  <div key={s.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white">{s.name}</p>
                        <span className="text-xs font-mono bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                          ID: {s.id}
                        </span>
                        {s.shop_type && s.shop_type !== 'retail' && (
                          <span className="text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded font-medium capitalize">
                            {s.shop_type.replace('_', ' ')}
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {s.owner_name} · {s.email}
                        {s.subscription_end_date && <> · Exp {fmtDate(s.subscription_end_date)}</>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {s.user_count || 0} users · {s.product_count || 0} products · {s.transaction_count || 0} txns
                      </p>
                    </div>
                    <div className="shrink-0">
                      <button
                        onClick={() => setManageShop(s)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600
                                   hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" /> Manage
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Analysis tab */}
        {tab === 'analysis' && <AnalysisTab shops={shops} />}

        {/* Audit Log tab */}
        {tab === 'audit' && (
          <div className="space-y-4">
            {/* Filter + refresh */}
            <div className="flex items-center gap-3 flex-wrap">
              <select
                className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={auditType}
                onChange={(e) => { setAuditType(e.target.value); setAuditPage(0); }}
              >
                <option value="">All types</option>
                <option value="product">Product deletions</option>
                <option value="transaction_void">Transaction voids</option>
              </select>
              <button
                onClick={loadAudit}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAudit ? 'animate-spin' : ''}`} />
              </button>
              {auditTotal > 0 && (
                <span className="text-xs text-gray-500">{auditTotal} record{auditTotal !== 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Table */}
            {loadingAudit && auditLog.length === 0 && (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            )}
            {!loadingAudit && auditLog.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No deleted records found</p>
              </div>
            )}
            {auditLog.length > 0 && (
              <div className="bg-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                      <th className="text-left px-4 py-3">Shop</th>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-left px-4 py-3">Record</th>
                      <th className="text-left px-4 py-3">Deleted By</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {auditLog.map((r) => {
                      const preview = r.original_data?.name
                        || r.original_data?.transaction_number
                        || `#${r.record_id}`;
                      return (
                        <AuditRow key={r.id} record={r} preview={preview} />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {Math.ceil(auditTotal / AUDIT_PAGE_SIZE) > 1 && (
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>Page {auditPage + 1} of {Math.ceil(auditTotal / AUDIT_PAGE_SIZE)}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                    disabled={auditPage === 0}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setAuditPage((p) => p + 1)}
                    disabled={auditPage >= Math.ceil(auditTotal / AUDIT_PAGE_SIZE) - 1}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Overview tab */}
        {tab === 'dashboard_tab' && <DashboardTab stats={stats} />}

        {/* Plans tab */}
        {tab === 'plans' && <PlansTab />}

        {/* Financial Summary tab */}
        {tab === 'financial' && <FinancialTab />}

        {/* Notifications tab */}
        {tab === 'notifications' && <NotificationsTab shops={shops} />}

      </div>

      {/* Modals */}
      {proofPayId    && <ProofModal   paymentId={proofPayId}  onClose={() => setProofPayId(null)} />}
      {rejectPayId   && <RejectModal  paymentId={rejectPayId} onClose={() => setRejectPayId(null)} onDone={() => { setRejectPayId(null); load(); }} />}
      {showCreateShop && <CreateShopModal onClose={() => setShowCreateShop(false)} onCreated={() => load()} />}
      {manageShop    && <ShopControlCenter shop={manageShop} onClose={() => setManageShop(null)} onDone={() => { setManageShop(null); load(); }} />}
    </div>
  );
}
