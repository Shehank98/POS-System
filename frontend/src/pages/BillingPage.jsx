import { useState, useEffect, useRef } from 'react';
import {
  CreditCard, CheckCircle2, AlertTriangle, XCircle,
  Upload, RefreshCw, QrCode, ShieldCheck, Zap, Clock,
  Calendar, Star, Trophy, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { paymentsApi } from '../api/client';

const PLANS = [
  { months: 1,  label: '1 Month',   price: 2500,  badge: null,            badgeCls: '',                              icon: null,                                   highlight: false },
  { months: 3,  label: '3 Months',  price: 6900,  badge: 'Save 10%',      badgeCls: 'bg-blue-100 text-blue-700',    icon: null,                                   highlight: false },
  { months: 6,  label: '6 Months',  price: 12000, badge: 'Recommended',   badgeCls: 'bg-primary-100 text-primary-700', icon: <Star className="w-3 h-3" />,        highlight: true  },
  { months: 12, label: '12 Months', price: 22000, badge: 'Best Value',    badgeCls: 'bg-amber-100 text-amber-700',  icon: <Trophy className="w-3 h-3" />,         highlight: false },
];

const STATUS_BADGE = {
  pending:  { label: 'Pending Review', cls: 'bg-yellow-100 text-yellow-700' },
  verified: { label: 'Approved',       cls: 'bg-green-100 text-green-700'   },
  rejected: { label: 'Rejected',       cls: 'bg-red-100 text-red-700'       },
};

const fmtDate  = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
}

function StatusCard({ user }) {
  const days   = daysUntil(user?.subscription_end_date);
  const status = user?.subscription_status;
  const planLabel = user?.subscription_plan || 'Standard';

  const isSuspended = status === 'suspended';
  const isExpired   = days !== null && days < 0;
  const isExpiring  = days !== null && days >= 0 && days <= 7;
  const isActive    = status === 'active' || status === 'trial';

  let cardCls = 'border-gray-200 bg-white';
  let iconColor = 'text-gray-400';
  let iconEl = <Calendar className="w-5 h-5" />;
  let statusLabel = 'No Active Plan';
  let statusCls = 'bg-gray-100 text-gray-600';

  if (isSuspended) {
    cardCls = 'border-red-200 bg-red-50'; iconColor = 'text-red-500';
    iconEl = <XCircle className="w-5 h-5" />;
    statusLabel = 'Suspended'; statusCls = 'bg-red-100 text-red-700';
  } else if (isExpired) {
    cardCls = 'border-red-200 bg-red-50'; iconColor = 'text-red-500';
    iconEl = <XCircle className="w-5 h-5" />;
    statusLabel = 'Expired'; statusCls = 'bg-red-100 text-red-700';
  } else if (isExpiring) {
    cardCls = 'border-yellow-200 bg-yellow-50'; iconColor = 'text-yellow-500';
    iconEl = <AlertTriangle className="w-5 h-5" />;
    statusLabel = 'Expiring Soon'; statusCls = 'bg-yellow-100 text-yellow-700';
  } else if (isActive) {
    cardCls = 'border-green-200 bg-green-50'; iconColor = 'text-green-500';
    iconEl = <CheckCircle2 className="w-5 h-5" />;
    statusLabel = status === 'trial' ? 'Trial Active' : 'Active';
    statusCls = 'bg-green-100 text-green-700';
  }

  return (
    <div className={`rounded-2xl border-2 p-5 ${cardCls}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={iconColor}>{iconEl}</div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Current Plan</p>
            <p className="font-bold text-gray-900 text-lg leading-tight">{planLabel}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${statusCls}`}>
          {statusLabel}
        </span>
      </div>

      {user?.subscription_end_date && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white/70 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">Expiry Date</p>
            <p className="font-semibold text-gray-800 text-sm">{fmtDate(user.subscription_end_date)}</p>
          </div>
          <div className="bg-white/70 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">Days Remaining</p>
            <p className={`font-semibold text-sm ${days !== null && days <= 7 ? 'text-red-600' : 'text-gray-800'}`}>
              {days !== null ? (days < 0 ? 'Expired' : `${days} day${days !== 1 ? 's' : ''}`) : '—'}
            </p>
          </div>
        </div>
      )}

      {(isExpiring || isExpired) && (
        <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${isExpired ? 'text-red-700' : 'text-yellow-700'}`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {isExpired
            ? 'Subscription expired. Select a plan below to renew.'
            : `Renew now — only ${days} day${days !== 1 ? 's' : ''} left.`}
        </div>
      )}
      {isSuspended && (
        <p className="mt-3 text-sm text-red-700 font-medium">Account suspended. Please contact support.</p>
      )}
    </div>
  );
}

function PlanCard({ plan, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(plan)}
      className={`relative w-full text-left rounded-xl border-2 p-4 transition-all duration-150 focus:outline-none ${
        selected
          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
          : plan.highlight
            ? 'border-primary-200 bg-white hover:border-primary-400'
            : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {plan.badge && (
        <span className={`absolute -top-2.5 right-3 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${plan.badgeCls}`}>
          {plan.icon}{plan.badge}
        </span>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-primary-500' : 'border-gray-300'}`}>
            {selected && <div className="w-2 h-2 rounded-full bg-primary-500" />}
          </div>
          <div>
            <p className={`font-semibold text-sm ${selected ? 'text-primary-800' : 'text-gray-800'}`}>{plan.label}</p>
            <p className="text-xs text-gray-400">Rs. {Math.round(plan.price / plan.months).toLocaleString()} / month</p>
          </div>
        </div>
        <p className={`font-bold text-base ${selected ? 'text-primary-700' : 'text-gray-900'}`}>
          Rs. {plan.price.toLocaleString()}
        </p>
      </div>
    </button>
  );
}

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);

  const [bankInfo,     setBankInfo]     = useState(null);
  const [payments,     setPayments]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [proofFile,    setProofFile]    = useState(null);
  const [proofB64,     setProofB64]     = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    async function load() {
      try {
        const [bankRes, payRes] = await Promise.all([paymentsApi.bankInfo(), paymentsApi.list()]);
        setBankInfo(bankRes.data);
        setPayments(payRes.data);
      } catch {
        toast.error('Failed to load billing info');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image too large - max 2 MB'); return; }
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofB64(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedPlan) { toast.error('Please select a plan'); return; }
    setSubmitting(true);
    try {
      const { data } = await paymentsApi.submit({
        amount:              selectedPlan.price,
        subscription_months: selectedPlan.months,
        payment_proof:       proofB64 || null,
      });
      setPayments((prev) => [data, ...prev]);
      setSelectedPlan(null);
      setProofFile(null);
      setProofB64('');
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Payment submitted! Admin will review it shortly.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        <div className="space-y-4">{[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      </div>
    );
  }

  const hasBankInfo = bankInfo && (bankInfo.bank_name || bankInfo.account_number || bankInfo.qr_url);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Billing &amp; Subscription</h1>
        <p className="text-sm text-gray-500">Manage your plan and submit renewal payments</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* LEFT — Status + Plan selection */}
        <div className="space-y-4">
          <StatusCard user={user} />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary-600" />
              <h2 className="font-semibold text-gray-900">Choose Your Plan</h2>
            </div>
            <div className="space-y-2.5">
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.months}
                  plan={plan}
                  selected={selectedPlan?.months === plan.months}
                  onSelect={setSelectedPlan}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Payment panel */}
        <div className="lg:sticky lg:top-6 space-y-4">

          {/* Bank details — always visible */}
          {hasBankInfo && (
            <div className="rounded-2xl border-2 border-gray-100 bg-white p-5 space-y-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary-600" />
                <h2 className="font-semibold text-gray-900">Bank Transfer Details</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3 text-sm">
                  {bankInfo.bank_name && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Bank</p>
                      <p className="font-semibold text-gray-800">{bankInfo.bank_name}</p>
                    </div>
                  )}
                  {bankInfo.account_name && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Account Name</p>
                      <p className="font-semibold text-gray-800">{bankInfo.account_name}</p>
                    </div>
                  )}
                  {bankInfo.account_number && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Account Number</p>
                      <p className="font-mono font-bold text-gray-900 text-base">{bankInfo.account_number}</p>
                    </div>
                  )}
                  {bankInfo.instructions && (
                    <p className="text-xs text-gray-500 italic">{bankInfo.instructions}</p>
                  )}
                </div>
                {bankInfo.qr_url && (
                  <div className="flex flex-col items-center justify-center">
                    <img src={bankInfo.qr_url} alt="QR" className="w-36 h-36 object-contain border border-gray-200 rounded-xl bg-white" />
                    <p className="text-xs text-gray-400 mt-1">Scan to pay</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment form */}
          <div className={`rounded-2xl border-2 p-5 space-y-4 transition-all ${selectedPlan ? 'border-primary-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50'}`}>
            {selectedPlan ? (
              <>
                {/* Amount summary */}
                <div className="flex items-center justify-between bg-primary-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-gray-500">Amount to Pay</p>
                    <p className="font-bold text-primary-800 text-2xl">Rs. {selectedPlan.price.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Plan</p>
                    <p className="font-semibold text-gray-700">{selectedPlan.label}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Upload */}
                  <div>
                    <label className="label">Upload Payment Receipt</label>
                    <div
                      className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-primary-300 transition-colors"
                      onClick={() => fileRef.current?.click()}
                    >
                      {proofB64 ? (
                        <div className="space-y-1">
                          <img src={proofB64} alt="receipt" className="h-24 mx-auto object-contain rounded-lg" />
                          <p className="text-xs text-gray-500">{proofFile?.name}</p>
                          <p className="text-xs text-primary-500">Click to change</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 py-2">
                          <Upload className="w-8 h-8 text-gray-300 mx-auto" />
                          <p className="text-sm font-medium text-gray-500">Click to upload receipt screenshot</p>
                          <p className="text-xs text-gray-300">PNG, JPG up to 2 MB</p>
                        </div>
                      )}
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </div>
                  </div>

                  {/* Trust badges */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: <Clock className="w-3.5 h-3.5" />,      text: 'Verified within 24 hours' },
                      { icon: <ShieldCheck className="w-3.5 h-3.5" />, text: 'Secure manual verification' },
                      { icon: <Zap className="w-3.5 h-3.5" />,         text: 'Instant activation after approval' },
                    ].map((b) => (
                      <div key={b.text} className="flex flex-col items-center gap-1 text-center bg-gray-50 rounded-xl p-2">
                        <span className="text-primary-500">{b.icon}</span>
                        <p className="text-xs text-gray-500 leading-tight">{b.text}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="btn-primary w-full justify-center py-3 text-sm font-semibold"
                    disabled={submitting}
                  >
                    {submitting
                      ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Submitting…</>
                      : `Submit for Verification — Rs. ${selectedPlan.price.toLocaleString()}`
                    }
                  </button>
                </form>
              </>
            ) : (
              /* Placeholder when no plan selected */
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-600">Select a plan to continue</p>
                  <p className="text-xs text-gray-400 mt-1">Choose a plan on the left to see payment details</p>
                </div>
              </div>
            )}
          </div>

          {/* Trust badges when no plan selected — still visible */}
          {!selectedPlan && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Clock className="w-3.5 h-3.5" />,      text: 'Verified within 24 hours' },
                { icon: <ShieldCheck className="w-3.5 h-3.5" />, text: 'Secure manual verification' },
                { icon: <Zap className="w-3.5 h-3.5" />,         text: 'Instant activation after approval' },
              ].map((b) => (
                <div key={b.text} className="flex flex-col items-center gap-1 text-center bg-white border border-gray-100 rounded-xl p-2.5">
                  <span className="text-primary-500">{b.icon}</span>
                  <p className="text-xs text-gray-500 leading-tight">{b.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment history — full width below */}
      {payments.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Payment History</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {payments.map((p) => {
              const badge = STATUS_BADGE[p.status] || STATUS_BADGE.pending;
              return (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                  <div>
                    <p className="font-medium text-gray-800">
                      Rs. {fmtMoney(p.amount)} &mdash; {p.subscription_months} month{p.subscription_months > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-400">{fmtDate(p.payment_date)}</p>
                    {p.notes && <p className="text-xs text-red-500 mt-0.5">Note: {p.notes}</p>}
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
