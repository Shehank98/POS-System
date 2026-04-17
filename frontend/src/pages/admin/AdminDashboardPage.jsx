import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Store, CreditCard, CheckCircle2, XCircle,
  Clock, LogOut, RefreshCw, Eye, ChevronDown, ChevronUp,
  AlertTriangle, Users, ClipboardList, Plus, CalendarPlus,
  KeyRound, Loader2, BarChart2, TrendingUp, DollarSign,
  ShoppingCart, Package,
} from 'lucide-react';
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
  active:    { label: 'Active',    cls: 'bg-green-100  text-green-700'  },
  trial:     { label: 'Trial',     cls: 'bg-blue-100   text-blue-700'   },
  expired:   { label: 'Expired',   cls: 'bg-red-100    text-red-700'    },
  suspended: { label: 'Suspended', cls: 'bg-gray-100   text-gray-700'   },
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
                  <option value="car_wash">Car Wash</option>
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

// ── Extend Subscription Modal ─────────────────────────────────
function ExtendSubModal({ shop, onClose, onDone }) {
  const [months,          setMonths]          = useState('0');
  const [status,          setStatus]          = useState(shop.subscription_status);
  const [extraSlots,      setExtraSlots]      = useState(String(shop.extra_staff_slots || 0));
  const [shopName,        setShopName]        = useState(shop.name || '');
  const [ownerName,       setOwnerName]       = useState(shop.owner_name || '');
  const [loginEmail,      setLoginEmail]      = useState(shop.email || '');
  const [phone,           setPhone]           = useState(shop.phone || '');
  const [address,         setAddress]         = useState(shop.address || '');
  const [logoUrl,         setLogoUrl]         = useState(shop.logo_url || '');
  const [contactEmail,    setContactEmail]    = useState(shop.contact_email || '');
  const [shopType,        setShopType]        = useState(shop.shop_type || 'retail');
  const [barcodeEnabled,  setBarcodeEnabled]  = useState(!!shop.barcode_enabled);
  const [busy,            setBusy]            = useState(false);

  async function handleSave() {
    if (!shopName.trim()) return toast.error('Shop name is required');
    if (!loginEmail.trim()) return toast.error('Login email is required');
    setBusy(true);
    try {
      await adminApi.updateSub(shop.id, {
        subscription_status: status,
        extend_months: parseInt(months, 10) || 0,
      });
      await adminApi.updateShop(shop.id, {
        name:              shopName,
        owner_name:        ownerName,
        email:             loginEmail,
        phone:             phone,
        address:           address,
        logo_url:          logoUrl,
        contact_email:     contactEmail,
        shop_type:         shopType,
        barcode_enabled:   barcodeEnabled,
        extra_staff_slots: parseInt(extraSlots, 10) || 0,
      });
      toast.success('Shop updated');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  const inputCls = 'bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-white text-lg">Manage — {shop.name}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">

          {/* ── Left column: Shop Info ── */}
          <div className="space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Shop Information</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Shop Name *</label>
              <input className={`w-full ${inputCls}`} value={shopName} onChange={(e) => setShopName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Owner Full Name</label>
              <input className={`w-full ${inputCls}`} placeholder="John Doe" value={ownerName}
                     onChange={(e) => setOwnerName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Login Email *</label>
              <input className={`w-full ${inputCls}`} type="email" placeholder="owner@shop.com" value={loginEmail}
                     onChange={(e) => setLoginEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Phone</label>
              <input className={`w-full ${inputCls}`} placeholder="+60 12-345 6789" value={phone}
                     onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Contact Email</label>
              <input className={`w-full ${inputCls}`} type="email" placeholder="shop@email.com" value={contactEmail}
                     onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Address</label>
              <input className={`w-full ${inputCls}`} placeholder="123 Jalan Utama..." value={address}
                     onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Logo URL
                <span className="ml-1 text-gray-600">(shows on receipt)</span>
              </label>
              <input className={`w-full ${inputCls}`} placeholder="https://..." value={logoUrl}
                     onChange={(e) => setLogoUrl(e.target.value)} />
              {logoUrl && (
                <div className="mt-1.5 bg-white rounded-lg p-2 flex items-center justify-center">
                  <img src={logoUrl} alt="logo preview" className="max-h-10 max-w-full object-contain" />
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: Settings + Subscription ── */}
          <div className="space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Shop Settings</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Shop Type</label>
              <select className={`w-full ${inputCls}`} value={shopType} onChange={(e) => setShopType(e.target.value)}>
                <option value="retail">Retail / General</option>
                <option value="car_wash">Car Wash</option>
                <option value="clothing">Clothing Shop</option>
                <option value="grocery">Grocery / Supermarket</option>
                <option value="restaurant">Restaurant / Cafe</option>
              </select>
            </div>
            <div className="flex items-center gap-3 bg-gray-700 rounded-lg px-3 py-2.5">
              <input type="checkbox" id="barcode_edit" checked={barcodeEnabled}
                     onChange={(e) => setBarcodeEnabled(e.target.checked)}
                     className="w-4 h-4 accent-primary-500 cursor-pointer" />
              <label htmlFor="barcode_edit" className="text-sm text-gray-200 cursor-pointer">
                Enable barcode scanner
              </label>
            </div>

            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold pt-2">Subscription</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select className={`w-full ${inputCls}`} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Add months (0 = status change only)</label>
              <input className={`w-full ${inputCls}`} type="number" min="0" max="36" value={months}
                     onChange={(e) => setMonths(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">
                Current expiry: {shop.subscription_end_date
                  ? new Date(shop.subscription_end_date).toLocaleDateString() : 'none'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Extra Staff Slots
                <span className="ml-1 text-gray-600">(default: 1 manager + 1 cashier)</span>
              </label>
              <input className={`w-full ${inputCls}`} type="number" min="0" max="20" value={extraSlots}
                     onChange={(e) => setExtraSlots(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Each extra slot allows +1 manager AND +1 cashier</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600">
            Cancel
          </button>
          <button onClick={handleSave} disabled={busy}
            className="flex-1 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg
                       hover:bg-primary-700 flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Users Modal (per shop) ────────────────────────────────────
function UsersModal({ shop, onClose }) {
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [changingPw, setChangingPw] = useState({}); // userId -> { open, pw, busy }

  useEffect(() => {
    adminApi.getShopUsers(shop.id)
      .then(({ data }) => setUsers(data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, [shop.id]);

  function openPw(userId) {
    setChangingPw((prev) => ({ ...prev, [userId]: { open: true, pw: '', busy: false } }));
  }

  function setPw(userId, val) {
    setChangingPw((prev) => ({ ...prev, [userId]: { ...prev[userId], pw: val } }));
  }

  async function savePw(userId) {
    const entry = changingPw[userId];
    if (!entry?.pw || entry.pw.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    setChangingPw((prev) => ({ ...prev, [userId]: { ...prev[userId], busy: true } }));
    try {
      await adminApi.changeUserPw(shop.id, userId, entry.pw);
      toast.success('Password changed');
      setChangingPw((prev) => ({ ...prev, [userId]: { open: false, pw: '', busy: false } }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
      setChangingPw((prev) => ({ ...prev, [userId]: { ...prev[userId], busy: false } }));
    }
  }

  const ROLE_CLS = {
    owner:   'bg-yellow-900/40 text-yellow-300',
    manager: 'bg-blue-900/40 text-blue-300',
    cashier: 'bg-gray-700 text-gray-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-5 max-w-md w-full space-y-4 max-h-[85vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Users - {shop.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {shop.extra_staff_slots > 0
                ? `Extra staff slots: +${shop.extra_staff_slots}`
                : 'Limit: 1 manager + 1 cashier (default)'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && users.length === 0 && (
          <p className="text-center py-6 text-gray-500 text-sm">No users found</p>
        )}

        {!loading && users.map((u) => {
          const cp = changingPw[u.id] || {};
          return (
            <div key={u.id} className="bg-gray-900 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{u.username}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                    ${ROLE_CLS[u.role] || ROLE_CLS.cashier}`}>
                    {u.role}
                  </span>
                </div>
                {!cp.open && (
                  <button
                    onClick={() => openPw(u.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-700
                               hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Change PW
                  </button>
                )}
              </div>
              {cp.open && (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="New password (min 4)"
                    className="flex-1 bg-gray-700 border border-gray-600 text-white text-xs
                               rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={cp.pw}
                    onChange={(e) => setPw(u.id, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && savePw(u.id)}
                    autoFocus
                  />
                  <button
                    onClick={() => savePw(u.id)}
                    disabled={cp.busy}
                    className="px-3 py-2 text-xs bg-primary-600 hover:bg-primary-700 text-white
                               rounded-lg font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    {cp.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                  </button>
                  <button
                    onClick={() => setChangingPw((prev) => ({ ...prev, [u.id]: { open: false, pw: '', busy: false } }))}
                    className="px-2 py-2 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
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

export default function AdminDashboardPage() {
  const logout   = useAdminStore((s) => s.logout);
  const navigate = useNavigate();

  const [tab,        setTab]        = useState('payments');
  const [stats,      setStats]      = useState(null);
  const [payments,   setPayments]   = useState([]);
  const [shops,      setShops]      = useState([]);
  const [auditLog,   setAuditLog]   = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage,  setAuditPage]  = useState(0);
  const [auditType,  setAuditType]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [proofPayId,   setProofPayId]   = useState(null);
  const [rejectPayId,  setRejectPayId]  = useState(null);
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [extendShop,     setExtendShop]     = useState(null);
  const [usersShop,      setUsersShop]      = useState(null);

  const AUDIT_PAGE_SIZE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, payRes, shopRes] = await Promise.all([
        adminApi.dashboard(),
        adminApi.listPayments(),
        adminApi.listShops(),
      ]);
      setStats(dashRes.data);
      setPayments(payRes.data);
      setShops(shopRes.data);
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

  function handleLogout() {
    logout();
    navigate('/admin/login', { replace: true });
  }

  const pendingCount = payments.filter((p) => p.status === 'pending').length;

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
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
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
            { id: 'payments', label: 'Payments',  badge: pendingCount },
            { id: 'shops',    label: 'Shops'      },
            { id: 'analysis', label: 'Analysis', icon: BarChart2 },
            { id: 'audit',    label: 'Audit Log'  },
          ].map((t) => (
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

        {/* Shops tab */}
        {tab === 'shops' && (
          <div className="space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{shops.length} shop{shops.length !== 1 ? 's' : ''}</p>
              <button
                onClick={() => setShowCreateShop(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700
                           text-white text-sm font-medium rounded-lg transition-colors"
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
            {!loading && shops.map((s) => {
              const badge = SUB_STATUS[s.subscription_status] || SUB_STATUS.expired;
              return (
                <div key={s.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
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
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.owner_name} · {s.email}
                      {s.subscription_end_date && (
                        <> · Expires {fmtDate(s.subscription_end_date)}</>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.user_count || 0} user{s.user_count !== 1 ? 's' : ''} ·{' '}
                      {s.product_count || 0} products ·{' '}
                      {s.transaction_count || 0} transactions
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <button
                      onClick={() => setUsersShop(s)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-700
                                 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                      title="View users / change passwords"
                    >
                      <Users className="w-3.5 h-3.5" /> Users
                    </button>
                    <button
                      onClick={() => setExtendShop(s)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-700
                                 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                      title="Manage subscription"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" /> Manage
                    </button>
                  </div>
                </div>
              );
            })}
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
      </div>

      {/* Modals */}
      {proofPayId  && <ProofModal  paymentId={proofPayId}  onClose={() => setProofPayId(null)} />}
      {rejectPayId && <RejectModal paymentId={rejectPayId} onClose={() => setRejectPayId(null)} onDone={() => { setRejectPayId(null); load(); }} />}
      {showCreateShop && <CreateShopModal onClose={() => setShowCreateShop(false)} onCreated={() => { load(); }} />}
      {extendShop  && <ExtendSubModal shop={extendShop}  onClose={() => setExtendShop(null)}  onDone={() => { setExtendShop(null);  load(); }} />}
      {usersShop   && <UsersModal     shop={usersShop}   onClose={() => setUsersShop(null)} />}
    </div>
  );
}
