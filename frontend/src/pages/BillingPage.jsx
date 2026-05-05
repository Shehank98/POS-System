import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Upload, RefreshCw,
  ShieldCheck, Zap, Clock, Check, X, ChevronRight, Flame,
  Star, CreditCard, Building2, QrCode, Smartphone, Banknote,
  Loader2, WifiOff, PartyPopper,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { paymentsApi, shopPayApi } from '../api/client';

// ── Plan tier fallback (used until API responds) ──────────────
const PLAN_COLORS = ['gray', 'primary', 'purple'];
const PLAN_CTAS   = ['Choose Basic', 'Upgrade to Standard', 'Go Premium'];

function apiPlanToTier(plan, idx) {
  const featureList = (Array.isArray(plan.features) ? plan.features : [])
    .map((f) => ({ text: f, ok: true }));
  return {
    id:       String(plan.id || plan.name.toLowerCase()),
    name:     plan.name,
    price:    Number(plan.base_monthly_price),
    color:    PLAN_COLORS[idx] ?? 'gray',
    popular:  idx === 1,
    features: featureList,
    cta:      PLAN_CTAS[idx] ?? `Choose ${plan.name}`,
  };
}

const TIER_PLANS_FALLBACK = [
  {
    id: 'basic', name: 'Basic', price: 2000, color: 'gray', popular: false,
    features: [
      { text: 'POS System', ok: true }, { text: 'Barcode Scanner', ok: true },
      { text: 'Sales Reports', ok: true }, { text: 'Refunds & Void', ok: false },
      { text: 'Analytics', ok: false }, { text: 'Pre-Orders', ok: false },
    ],
    cta: 'Choose Basic',
  },
  {
    id: 'standard', name: 'Standard', price: 3500, color: 'primary', popular: true,
    features: [
      { text: 'Everything in Basic', ok: true }, { text: 'Refunds & Void', ok: true },
      { text: 'Reports & Analytics', ok: true }, { text: 'Pre-Orders', ok: true },
      { text: 'Loyalty Points', ok: true }, { text: 'Mobile App', ok: true },
    ],
    cta: 'Upgrade to Standard',
  },
  {
    id: 'premium', name: 'Premium', price: 6000, color: 'purple', popular: false,
    features: [
      { text: 'Everything in Standard', ok: true }, { text: 'Multi-Branch', ok: true },
      { text: 'Unlimited Products', ok: true }, { text: 'Priority Support', ok: true },
    ],
    cta: 'Go Premium',
  },
];

// ── Duration options ──────────────────────────────────────────
const DURATIONS = [
  { months: 1,  label: '1 Month',   discount: 0,    badge: null,         badgeCls: '',                            fire: false },
  { months: 3,  label: '3 Months',  discount: 0.10, badge: 'Save 10%',   badgeCls: 'bg-blue-100 text-blue-700',   fire: false },
  { months: 6,  label: '6 Months',  discount: 0.15, badge: 'Best Value', badgeCls: 'bg-amber-100 text-amber-700', fire: true  },
  { months: 12, label: '12 Months', discount: 0.20, badge: 'Save 20%',   badgeCls: 'bg-green-100 text-green-700', fire: false },
];

const STATUS_BADGE = {
  pending:  { label: 'Pending Review', cls: 'bg-yellow-100 text-yellow-700' },
  verified: { label: 'Approved',       cls: 'bg-green-100  text-green-700'  },
  rejected: { label: 'Rejected',       cls: 'bg-red-100    text-red-700'    },
};

const fmtDate  = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const fmtMoney = (n) => Number(n || 0).toLocaleString();

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000);
}

function calcPrice(tierPrice, months, discount) {
  return Math.round(tierPrice * months * (1 - discount));
}

// ── Current Plan Card ─────────────────────────────────────────
function CurrentPlanCard({ user, onRenew, onUpgrade }) {
  const days        = daysUntil(user?.subscription_end_date);
  const status      = user?.subscription_status;
  const plan        = user?.subscription_plan || 'Standard';
  const isActive    = status === 'active' || status === 'trial';
  const isExpiring  = days !== null && days >= 0 && days <= 7;
  const isExpired   = days !== null && days < 0;
  const isSuspended = status === 'suspended';

  const progressPct  = days === null ? 0 : isExpired ? 0 : Math.min(Math.round((days / 90) * 100), 100);
  const progressColor = (isExpired || isSuspended) ? 'bg-red-500' : isExpiring ? 'bg-amber-400' : 'bg-green-500';

  let borderCls = 'border-gray-200', bgCls = 'bg-white';
  if (isSuspended || isExpired) { borderCls = 'border-red-200';    bgCls = 'bg-red-50/60';    }
  else if (isExpiring)          { borderCls = 'border-amber-200';  bgCls = 'bg-amber-50/60';  }
  else if (isActive)            { borderCls = 'border-green-200';  bgCls = 'bg-green-50/40';  }

  const statusInfo = isSuspended
    ? { label: 'Suspended',     cls: 'bg-red-100 text-red-700',     icon: <XCircle     className="w-4 h-4" /> }
    : isExpired
    ? { label: 'Expired',       cls: 'bg-red-100 text-red-700',     icon: <XCircle     className="w-4 h-4" /> }
    : isExpiring
    ? { label: 'Expiring Soon', cls: 'bg-amber-100 text-amber-700', icon: <AlertTriangle className="w-4 h-4" /> }
    : status === 'trial'
    ? { label: 'Trial',         cls: 'bg-blue-100 text-blue-700',   icon: <CheckCircle2 className="w-4 h-4" /> }
    : isActive
    ? { label: 'Active',        cls: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-4 h-4" /> }
    : { label: 'Inactive',      cls: 'bg-gray-100 text-gray-600',   icon: <Clock className="w-4 h-4" /> };

  return (
    <div className={`rounded-2xl border-2 p-5 ${borderCls} ${bgCls}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Current Plan</p>
          <p className="text-2xl font-black text-gray-900 leading-tight">{plan}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${statusInfo.cls}`}>
          {statusInfo.icon} {statusInfo.label}
        </span>
      </div>

      {user?.subscription_end_date && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/70 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Expires</p>
              <p className="font-semibold text-gray-800 text-sm">{fmtDate(user.subscription_end_date)}</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Remaining</p>
              <p className={`font-bold text-sm ${(isExpiring || isExpired) ? 'text-red-600' : 'text-gray-800'}`}>
                {days === null ? '—' : isExpired ? 'Expired' : `${days} day${days !== 1 ? 's' : ''}`}
                {isExpiring && !isExpired && <span className="ml-1">⚠️</span>}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Subscription usage</span>
              <span>{progressPct}% remaining</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </>
      )}

      {(isExpiring || isExpired) && (
        <div className={`mt-3 text-xs font-medium px-3 py-2 rounded-xl ${isExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
          {isExpired
            ? 'Subscription expired. Select a plan below to renew access.'
            : `Renew now — only ${days} day${days !== 1 ? 's' : ''} remaining.`}
        </div>
      )}

      {!isSuspended && (
        <div className="mt-4 flex gap-2">
          <button onClick={onUpgrade} className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors">
            Upgrade Plan
          </button>
          <button onClick={onRenew} className="flex-1 py-2 rounded-xl border-2 border-primary-300 text-primary-700 hover:bg-primary-50 text-sm font-semibold transition-colors">
            Renew Now
          </button>
        </div>
      )}
      {isSuspended && (
        <p className="mt-3 text-sm text-red-700 font-medium bg-red-100 rounded-xl px-3 py-2">
          Account suspended. Please contact support.
        </p>
      )}
    </div>
  );
}

// ── Tier card colour map ──────────────────────────────────────
const TIER_COLORS = {
  gray:    { border: 'border-gray-200',    selBorder: 'border-gray-400',    selBg: 'bg-gray-50',    badge: 'bg-gray-700 text-white',        btn: 'bg-gray-800 hover:bg-gray-900',    glow: '' },
  primary: { border: 'border-primary-200', selBorder: 'border-primary-500', selBg: 'bg-primary-50', badge: 'bg-primary-600 text-white',      btn: 'bg-primary-600 hover:bg-primary-700', glow: 'shadow-primary-100 shadow-lg' },
  purple:  { border: 'border-purple-200',  selBorder: 'border-purple-500',  selBg: 'bg-purple-50',  badge: 'bg-purple-700 text-white',       btn: 'bg-purple-700 hover:bg-purple-800', glow: '' },
};

function TierCard({ plan, selected, onSelect }) {
  const c = TIER_COLORS[plan.color];
  return (
    <div
      onClick={() => onSelect(plan)}
      className={`relative rounded-2xl border-2 p-5 flex flex-col transition-all duration-150 cursor-pointer
        ${selected ? `${c.selBorder} ${c.selBg} shadow-lg` : `${c.border} bg-white hover:shadow-md`}
        ${plan.popular && !selected ? c.glow : ''}`}
    >
      {plan.popular && (
        <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full shadow whitespace-nowrap ${c.badge}`}>
          <Star className="w-3 h-3" /> Most Popular
        </div>
      )}

      <div className="mb-4 mt-1">
        <p className="font-black text-xl text-gray-900">{plan.name}</p>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-black text-gray-900">Rs. {fmtMoney(plan.price)}</span>
          <span className="text-xs text-gray-400 font-medium">/ mo</span>
        </div>
      </div>

      <ul className="space-y-2 flex-1 mb-5">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-center gap-2 text-sm">
            {f.ok
              ? <Check className="w-4 h-4 text-green-500 shrink-0" />
              : <X    className="w-4 h-4 text-gray-300 shrink-0" />}
            <span className={f.ok ? 'text-gray-700' : 'text-gray-400'}>{f.text}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect(plan); }}
        className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${c.btn} ${selected ? 'opacity-90' : ''}`}
      >
        {selected ? <span className="flex items-center justify-center gap-1.5"><Check className="w-4 h-4" /> Selected</span> : plan.cta}
      </button>
    </div>
  );
}

// ── Duration selector ─────────────────────────────────────────
function DurationSelector({ tierPlan, selected, onSelect }) {
  return (
    <div className="rounded-2xl border-2 border-gray-100 bg-white p-5">
      <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary-600" />
        Choose Duration
        <span className="text-xs font-normal text-gray-400">— {tierPlan.name} plan</span>
      </h2>
      <div className="space-y-2.5">
        {DURATIONS.map((d) => {
          const total    = calcPrice(tierPlan.price, d.months, d.discount);
          const fullCost = tierPlan.price * d.months;
          const saving   = fullCost - total;
          const isSel    = selected?.months === d.months;

          return (
            <button
              key={d.months}
              type="button"
              onClick={() => onSelect(d)}
              className={`relative w-full text-left rounded-xl border-2 px-4 py-3 transition-all
                ${isSel ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              {d.badge && (
                <span className={`absolute -top-2.5 right-3 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${d.badgeCls}`}>
                  {d.fire && <Flame className="w-3 h-3" />} {d.badge}
                </span>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? 'border-primary-500' : 'border-gray-300'}`}>
                    {isSel && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${isSel ? 'text-primary-800' : 'text-gray-800'}`}>{d.label}</p>
                    {saving > 0 && <p className="text-xs text-green-600 font-medium">Save Rs. {fmtMoney(saving)}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-base ${isSel ? 'text-primary-700' : 'text-gray-900'}`}>Rs. {fmtMoney(total)}</p>
                  {d.discount > 0 && <p className="text-xs text-gray-400 line-through">Rs. {fmtMoney(fullCost)}</p>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Payment section ───────────────────────────────────────────
function PaymentSection({ tierPlan, duration, bankInfo, onSubmit, submitting }) {
  const fileRef              = useRef();
  const [proofFile, setProofFile] = useState(null);
  const [proofB64,  setProofB64]  = useState('');

  const total = (tierPlan && duration) ? calcPrice(tierPlan.price, duration.months, duration.discount) : 0;

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only image files are accepted'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image too large — max 2 MB'); return; }
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofB64(ev.target.result);
    reader.readAsDataURL(file);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ proofB64, resetProof: () => { setProofFile(null); setProofB64(''); if (fileRef.current) fileRef.current.value = ''; } });
  }

  const hasBankInfo = bankInfo && (bankInfo.bank_name || bankInfo.account_number);

  return (
    <div className="rounded-2xl border-2 border-gray-100 bg-white p-5 space-y-5">
      <h2 className="font-bold text-gray-900 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-primary-600" />
        Payment Instructions
      </h2>

      {/* Bank details */}
      {hasBankInfo && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
          {[
            { label: 'Bank',           value: bankInfo.bank_name      },
            { label: 'Branch',         value: bankInfo.branch         },
            { label: 'Account Number', value: bankInfo.account_number, mono: true },
            { label: 'Account Name',   value: bankInfo.account_name   },
          ].filter((r) => r.value).map((row) => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-xs text-gray-400 uppercase tracking-wide">{row.label}</span>
              <span className={`font-semibold text-gray-800 text-sm ${row.mono ? 'font-mono text-base' : ''}`}>{row.value}</span>
            </div>
          ))}
          {bankInfo.instructions && (
            <p className="text-xs text-gray-500 italic border-t border-gray-200 pt-2">{bankInfo.instructions}</p>
          )}
        </div>
      )}

      {/* Amount summary */}
      {total > 0 && (
        <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs text-gray-500">Amount to Pay</p>
            <p className="text-2xl font-black text-primary-700">Rs. {fmtMoney(total)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 font-medium">{tierPlan.name} · {duration.label}</p>
            {duration.discount > 0 && (
              <p className="text-xs text-green-600 font-semibold">{Math.round(duration.discount * 100)}% off</p>
            )}
          </div>
        </div>
      )}

      {/* Upload form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Upload Payment Screenshot</p>
          <div
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
              ${proofB64 ? 'border-primary-300 bg-primary-50/40' : 'border-gray-200 hover:border-primary-300'}`}
            onClick={() => fileRef.current?.click()}
          >
            {proofB64 ? (
              <div className="space-y-1">
                <img src={proofB64} alt="receipt" className="h-28 mx-auto object-contain rounded-lg" />
                <p className="text-xs text-gray-500">{proofFile?.name}</p>
                <p className="text-xs text-primary-500 font-medium">Tap to change</p>
              </div>
            ) : (
              <div className="py-4 space-y-2">
                <Upload className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-sm font-medium text-gray-500">Tap to upload screenshot</p>
                <p className="text-xs text-gray-300">PNG, JPG — max 2 MB</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <Clock className="w-3.5 h-3.5" />,      text: 'Verified 24 hrs'    },
            { icon: <ShieldCheck className="w-3.5 h-3.5" />, text: 'Secure & private'   },
            { icon: <Zap className="w-3.5 h-3.5" />,         text: 'Instant activation' },
          ].map((b) => (
            <div key={b.text} className="flex flex-col items-center gap-1 text-center bg-gray-50 rounded-xl p-2">
              <span className="text-primary-500">{b.icon}</span>
              <p className="text-[11px] text-gray-500 leading-tight">{b.text}</p>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting || !tierPlan || !duration}
          className="btn-primary w-full justify-center py-3 text-sm font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {submitting
            ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Submitting…</>
            : total > 0
              ? `Submit Payment — Rs. ${fmtMoney(total)}`
              : 'Select a plan & duration above'}
        </button>
      </form>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
// ── Inactive Shop Payment Form ────────────────────────────────
// ── HelaPlay QR payment panel ─────────────────────────────────
function HelaPlayQRPanel({ onPaid }) {
  const [qrSession,  setQrSession]  = useState(null); // { reference, qr_data, amount, expires_at }
  const [generating, setGenerating] = useState(false);
  const [status,     setStatus]     = useState(0);    // 0=pending, 2=paid, -1=failed, -2=expired
  const [timeLeft,   setTimeLeft]   = useState(null);
  const pollRef  = useRef(null);
  const timerRef = useRef(null);

  const clearPolling = useCallback(() => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
  }, []);

  useEffect(() => () => clearPolling(), [clearPolling]);

  async function generateQR() {
    setGenerating(true);
    setStatus(0);
    clearPolling();
    try {
      const { data } = await shopPayApi.generateBillingQR();
      setQrSession(data);
      startPolling(data.reference, data.expires_at);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate QR. Check system configuration.');
    } finally {
      setGenerating(false);
    }
  }

  function startPolling(reference, expiresAt) {
    // Countdown timer
    timerRef.current = setInterval(() => {
      const secs = Math.max(0, Math.round((new Date(expiresAt) - Date.now()) / 1000));
      setTimeLeft(secs);
      if (secs === 0) clearPolling();
    }, 1000);

    // Poll for payment status every 3s
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await shopPayApi.billingQRStatus(reference);
        const ps = data.payment_status;
        if (ps !== 0) {
          setStatus(ps);
          clearPolling();
          if (ps === 2) {
            // Small delay then reload so subscription guard re-evaluates
            setTimeout(() => { onPaid(); }, 2500);
          }
        }
      } catch { /* silent — keep polling */ }
    }, 3000);
  }

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const expired = timeLeft === 0 || status === -2;

  if (status === 2) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <PartyPopper className="w-14 h-14 text-green-500" />
        <p className="text-xl font-bold text-green-700">Payment Confirmed!</p>
        <p className="text-sm text-gray-500">Your account is being activated — refreshing…</p>
        <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (status === -1) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <XCircle className="w-12 h-12 text-red-400" />
        <p className="font-semibold text-red-600">Payment Failed</p>
        <button onClick={generateQR}
          className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">
          Try Again
        </button>
      </div>
    );
  }

  if (!qrSession) {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5"><Smartphone className="w-4 h-4" /> How to pay with HelaPlay</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700 mt-2">
            <li>Tap "Generate QR Code" below</li>
            <li>Open your HelaPlay / LankaQR mobile app</li>
            <li>Scan the QR code displayed on screen</li>
            <li>Confirm the payment of <strong>LKR 2,500</strong></li>
            <li>Your account activates instantly upon confirmation</li>
          </ol>
        </div>
        <button
          onClick={generateQR}
          disabled={generating}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold
                     flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {generating
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating QR…</>
            : <><QrCode className="w-5 h-5" /> Generate QR Code — LKR 2,500</>}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* QR code box */}
      <div className="flex flex-col items-center gap-3">
        <div className={`p-3 bg-white rounded-2xl border-2 shadow-sm transition-opacity
                         ${expired ? 'opacity-30 border-red-300' : 'border-primary-300'}`}>
          <QRCodeSVG value={qrSession.qr_data} size={220} level="M" includeMargin />
        </div>

        {/* Timer */}
        {!expired && timeLeft !== null && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Expires in <span className="font-bold text-amber-600">{fmtTime(timeLeft)}</span></span>
          </div>
        )}

        {expired && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-red-500 font-medium flex items-center gap-1.5">
              <WifiOff className="w-4 h-4" /> QR code expired
            </p>
            <button onClick={generateQR}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" /> Generate New QR
            </button>
          </div>
        )}
      </div>

      {/* Amount + instructions */}
      <div className="bg-gray-50 rounded-xl p-4 text-center space-y-1">
        <p className="text-2xl font-black text-gray-900">LKR 2,500</p>
        <p className="text-xs text-gray-500">Scan with HelaPlay or any LankaQR-compatible app</p>
      </div>

      {/* Polling indicator */}
      {!expired && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Waiting for payment confirmation…
        </div>
      )}

      <button onClick={generateQR} disabled={generating}
        className="w-full py-2 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4" /> Regenerate QR
      </button>
    </div>
  );
}

// ── Bank transfer panel ───────────────────────────────────────
function BankTransferPanel({ user, onProofsChange }) {
  const [fileData,   setFileData]   = useState(null);
  const [fileName,   setFileName]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('File must be under 8MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setFileData(ev.target.result); setFileName(file.name); };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fileData) { toast.error('Please upload a payment proof image'); return; }
    setSubmitting(true);
    try {
      await shopPayApi.uploadProof({ fileData });
      toast.success('Payment proof submitted! Admin will review and activate your account.');
      setFileData(null);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      onProofsChange?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit proof');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Transfer <strong>LKR 2,500</strong> to the company bank account and upload the receipt below.
        Your account will be activated once an admin verifies the payment.
      </p>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 space-y-1">
        <p className="font-semibold text-gray-800">Bank Transfer Details</p>
        <p>Bank: <strong>Contact your agent for bank details</strong></p>
        <p>Amount: <strong>LKR 2,500.00</strong></p>
        <p>Reference: <strong>{user?.shop_reference_id || 'Your Shop ID'}</strong></p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6
                      cursor-pointer transition-colors
                      ${fileData ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50'}`}
        >
          <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
          {fileData ? (
            <><CheckCircle2 className="w-8 h-8 text-green-500 mb-2" /><p className="text-sm text-green-700 font-medium">{fileName}</p></>
          ) : (
            <><Upload className="w-8 h-8 text-gray-400 mb-2" /><p className="text-sm text-gray-500">Click to upload bank slip</p><p className="text-xs text-gray-400">JPG, PNG, or PDF · max 8MB</p></>
          )}
        </div>
        <button type="submit" disabled={!fileData || submitting}
          className="w-full py-3 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold
                     disabled:opacity-50 flex items-center justify-center gap-2">
          {submitting
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting…</>
            : <><Upload className="w-4 h-4" /> Submit Payment Proof</>}
        </button>
      </form>
    </div>
  );
}

function InactiveShopBilling({ user }) {
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [tab,    setTab]    = useState('qr'); // 'qr' | 'bank'
  const [proofs, setProofs] = useState([]);

  useEffect(() => {
    shopPayApi.myProofs()
      .then(({ data }) => setProofs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  async function reloadProofs() {
    try { const { data } = await shopPayApi.myProofs(); setProofs(Array.isArray(data) ? data : []); } catch { /* noop */ }
  }

  async function handlePaid() {
    // Reload user so activation_status updates and SubscriptionGuard lifts
    try { await refreshUser(); } catch { /* noop */ }
    window.location.reload();
  }

  const statusColor = { pending: 'text-yellow-600', verified: 'text-green-600', rejected: 'text-red-600' };

  return (
    <div className="max-w-lg mx-auto space-y-6">

      {/* Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
        <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-amber-900">Account Activation Required</h2>
        <p className="text-sm text-amber-700 mt-1">
          Pay <strong>LKR 2,500</strong> to activate your account and access all features.
        </p>
      </div>

      {/* Payment method tabs */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('qr')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors
              ${tab === 'qr'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            <QrCode className="w-4 h-4" /> HelaPlay QR
            <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">INSTANT</span>
          </button>
          <button
            onClick={() => setTab('bank')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors
              ${tab === 'bank'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Banknote className="w-4 h-4" /> Bank Transfer
          </button>
        </div>

        {/* Tab content */}
        <div className="p-5">
          {tab === 'qr'
            ? <HelaPlayQRPanel onPaid={handlePaid} />
            : <BankTransferPanel user={user} onProofsChange={reloadProofs} />}
        </div>
      </div>

      {/* Previous submissions */}
      {proofs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">Previous Submissions</h3>
          <div className="space-y-2">
            {proofs.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                <div>
                  <p className="font-medium text-gray-700 capitalize">
                    {p.payment_method === 'helaPay' ? '⚡ HelaPlay QR' : '🏦 Bank Transfer'} — LKR {Number(p.amount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()}</p>
                  {p.admin_note && <p className="text-xs text-red-500 mt-0.5">Note: {p.admin_note}</p>}
                </div>
                <span className={`text-xs font-semibold capitalize ${statusColor[p.status] || 'text-gray-500'}`}>
                  {p.status === 'pending' && p.payment_method === 'helaPay' ? '⏳ Pending' : p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);

  const [bankInfo,     setBankInfo]     = useState(null);
  const [payments,     setPayments]     = useState([]);
  const [tierPlans,    setTierPlans]    = useState(TIER_PLANS_FALLBACK);
  const [loading,      setLoading]      = useState(true);
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedDur,  setSelectedDur]  = useState(null);
  const [submitting,   setSubmitting]   = useState(false);

  const plansSectionRef = useRef();

  useEffect(() => {
    async function load() {
      try {
        const [bankRes, payRes, plansRes] = await Promise.all([
          paymentsApi.bankInfo(),
          paymentsApi.list(),
          paymentsApi.plans().catch(() => ({ data: [] })),
        ]);
        setBankInfo(bankRes.data);
        setPayments(payRes.data);
        if (plansRes.data?.length > 0) {
          setTierPlans(plansRes.data.map(apiPlanToTier));
        }
      } catch {
        toast.error('Failed to load billing info');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function scrollToPlans() {
    plansSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleTierSelect(tier) {
    setSelectedTier(tier);
    setSelectedDur(null);
  }

  async function handleSubmit({ proofB64, resetProof }) {
    if (!selectedTier) { toast.error('Please select a plan'); return; }
    if (!selectedDur)  { toast.error('Please select a duration'); return; }

    const total = calcPrice(selectedTier.price, selectedDur.months, selectedDur.discount);
    setSubmitting(true);
    try {
      const { data } = await paymentsApi.submit({
        amount:              total,
        subscription_months: selectedDur.months,
        plan_name:           selectedTier.name,
        payment_proof:       proofB64 || null,
      });
      setPayments((prev) => [data, ...prev]);
      setSelectedTier(null);
      setSelectedDur(null);
      resetProof();
      toast.success('Payment submitted! Admin will review it shortly.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  // Unactivated shop — show activation payment form only
  if (user?.activation_status != null && user.activation_status !== 'active') {
    return <InactiveShopBilling user={user} />;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Billing &amp; Plans</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your subscription and renew your plan</p>
      </div>

      {/* 1 — Current Plan */}
      <CurrentPlanCard user={user} onRenew={scrollToPlans} onUpgrade={scrollToPlans} />

      {/* 2 — Plan Tier Cards */}
      <div ref={plansSectionRef}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Choose Your Plan</h2>
            <p className="text-sm text-gray-400">Pick the right plan for your business</p>
          </div>
          {selectedTier && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {selectedTier.name} selected
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tierPlans.map((plan) => (
            <TierCard
              key={plan.id}
              plan={plan}
              selected={selectedTier?.id === plan.id}
              onSelect={handleTierSelect}
            />
          ))}
        </div>
      </div>

      {/* 3 — Duration Selector (shown after tier picked) */}
      {selectedTier && (
        <DurationSelector
          tierPlan={selectedTier}
          selected={selectedDur}
          onSelect={setSelectedDur}
        />
      )}

      {/* 4 — Payment Section */}
      <PaymentSection
        tierPlan={selectedTier}
        duration={selectedDur}
        bankInfo={bankInfo}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      {/* 5 — Payment History */}
      {payments.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Payment History</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {payments.map((p) => {
              const badge = STATUS_BADGE[p.status] || STATUS_BADGE.pending;
              return (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {p.plan_name && <span className="text-primary-600">{p.plan_name} · </span>}
                      Rs. {fmtMoney(p.amount)}
                      <span className="text-gray-400 font-normal"> · {p.subscription_months} mo</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(p.payment_date)}</p>
                    {p.notes && <p className="text-xs text-red-500 mt-0.5">Note: {p.notes}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-3 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked features teaser */}
      <div className="rounded-2xl border-2 border-dashed border-gray-200 p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Unlock with upgrade</p>
        <div className="flex flex-wrap gap-2">
          {['Loyalty Points 🔒', 'Multi-Branch 🔒', 'Advanced Reports 🔒', 'Priority Support 🔒'].map((f) => (
            <span key={f} className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 font-medium">{f}</span>
          ))}
        </div>
        <button
          onClick={scrollToPlans}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
        >
          View upgrade options <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}
