import { useState, useEffect, useRef } from 'react';
import {
  CreditCard, CheckCircle2, AlertTriangle, XCircle,
  Clock, Upload, RefreshCw, ExternalLink, QrCode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { paymentsApi } from '../api/client';

const STATUS_BADGE = {
  pending:  { label: 'Pending Review', cls: 'bg-yellow-100 text-yellow-700' },
  verified: { label: 'Approved',       cls: 'bg-green-100  text-green-700'  },
  rejected: { label: 'Rejected',       cls: 'bg-red-100    text-red-700'    },
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }) : '—';
const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
}

function SubscriptionBanner({ user }) {
  const days = daysUntil(user?.subscription_end_date);
  const status = user?.subscription_status;

  if (status === 'suspended') {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
        <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800">Account Suspended</p>
          <p className="text-sm text-red-600">Your account has been suspended. Please contact support.</p>
        </div>
      </div>
    );
  }

  if (days !== null && days < 0) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
        <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800">Subscription Expired</p>
          <p className="text-sm text-red-600">
            Expired on {fmtDate(user.subscription_end_date)}. You are in read-only mode.
            Submit a payment below to renew.
          </p>
        </div>
      </div>
    );
  }

  if (days !== null && days <= 5) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 border border-yellow-200">
        <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-yellow-800">Subscription Expiring Soon</p>
          <p className="text-sm text-yellow-700">
            Expires in <strong>{days} day{days !== 1 ? 's' : ''}</strong> ({fmtDate(user.subscription_end_date)}).
            Renew now to avoid interruption.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'active' || status === 'trial') {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-green-800">
            Subscription {status === 'trial' ? '(Trial)' : 'Active'}
          </p>
          <p className="text-sm text-green-700">
            {days !== null
              ? `Expires in ${days} day${days !== 1 ? 's' : ''} — ${fmtDate(user.subscription_end_date)}`
              : 'No expiry date set'}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);

  const [bankInfo,   setBankInfo]   = useState(null);
  const [payments,   setPayments]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  // Form state
  const [amount,     setAmount]     = useState('');
  const [months,     setMonths]     = useState('1');
  const [proofFile,  setProofFile]  = useState(null);
  const [proofB64,   setProofB64]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    async function load() {
      try {
        const [bankRes, payRes] = await Promise.all([
          paymentsApi.bankInfo(),
          paymentsApi.list(),
        ]);
        setBankInfo(bankRes.data);
        setPayments(payRes.data);
      } catch (err) {
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
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image too large — max 2 MB');
      return;
    }
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofB64(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await paymentsApi.submit({
        amount:              Number(amount),
        subscription_months: Number(months),
        payment_proof:       proofB64 || null,
      });
      setPayments((prev) => [data, ...prev]);
      setAmount('');
      setMonths('1');
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
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-sm text-gray-500">Manage your subscription and submit payments</p>
      </div>

      {/* Subscription status */}
      <SubscriptionBanner user={user} />

      {/* Bank transfer details */}
      {bankInfo && (bankInfo.bank_name || bankInfo.account_number || bankInfo.qr_url) && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Bank Transfer Details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bank details */}
            <div className="space-y-2 text-sm">
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
                <p className="text-xs text-gray-500 italic pt-1">{bankInfo.instructions}</p>
              )}
            </div>

            {/* QR code */}
            {bankInfo.qr_url && (
              <div className="flex flex-col items-center justify-center">
                <img
                  src={bankInfo.qr_url}
                  alt="Bank transfer QR code"
                  className="w-40 h-40 object-contain border border-gray-200 rounded-lg"
                />
                <p className="text-xs text-gray-400 mt-1">Scan to transfer</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment submission form */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900">Submit Payment</h2>
        </div>
        <p className="text-sm text-gray-500">
          After transferring the amount, fill in the form below and attach your receipt screenshot.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount Paid</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Months to Renew</label>
              <select
                className="input"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              >
                {[1, 2, 3, 6, 12].map((m) => (
                  <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Payment Screenshot (optional)</label>
            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-primary-300 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {proofB64 ? (
                <div className="space-y-2">
                  <img src={proofB64} alt="proof" className="h-24 mx-auto object-contain rounded" />
                  <p className="text-xs text-gray-500">{proofFile?.name}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-400">Click to upload screenshot</p>
                  <p className="text-xs text-gray-300">PNG, JPG up to 2 MB</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full justify-center"
            disabled={submitting}
          >
            {submitting
              ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Submitting…</>
              : 'Submit Payment for Review'
            }
          </button>
        </form>
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Payment History</h2>
          <div className="space-y-2">
            {payments.map((p) => {
              const badge = STATUS_BADGE[p.status] || STATUS_BADGE.pending;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {fmtMoney(p.amount)} — {p.subscription_months} month{p.subscription_months > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-400">{fmtDate(p.payment_date)}</p>
                    {p.notes && (
                      <p className="text-xs text-red-500 mt-0.5">Note: {p.notes}</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${badge.cls}`}>
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
