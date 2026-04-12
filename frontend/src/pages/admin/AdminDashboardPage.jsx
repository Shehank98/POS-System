import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Store, CreditCard, CheckCircle2, XCircle,
  Clock, LogOut, RefreshCw, Eye, ChevronDown, ChevronUp,
  AlertTriangle, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/client';
import useAdminStore from '../../store/adminStore';

const fmtDate  = (d) => d ? new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }) : '—';
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

export default function AdminDashboardPage() {
  const logout   = useAdminStore((s) => s.logout);
  const navigate = useNavigate();

  const [tab,      setTab]      = useState('payments');
  const [stats,    setStats]    = useState(null);
  const [payments, setPayments] = useState([]);
  const [shops,    setShops]    = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [proofPayId,  setProofPayId]  = useState(null);
  const [rejectPayId, setRejectPayId] = useState(null);

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

  useEffect(() => { load(); }, [load]);

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
        <div className="flex gap-1 bg-gray-800 rounded-xl p-1 w-fit">
          {[
            { id: 'payments', label: 'Payments', badge: pendingCount },
            { id: 'shops',    label: 'Shops'    },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${tab === t.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
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
                        {fmtMoney(p.amount)} — {p.subscription_months} month{p.subscription_months > 1 ? 's' : ''}
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
            {loading && [...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
            ))}
            {!loading && shops.map((s) => {
              const badge = SUB_STATUS[s.subscription_status] || SUB_STATUS.expired;
              return (
                <div key={s.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      {s.owner_name} · {s.email}
                      {s.subscription_end_date && (
                        <> · Expires {fmtDate(s.subscription_end_date)}</>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.user_count || 0} users · {s.product_count || 0} products · {s.transaction_count || 0} transactions
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {proofPayId  && <ProofModal  paymentId={proofPayId}  onClose={() => setProofPayId(null)} />}
      {rejectPayId && <RejectModal paymentId={rejectPayId} onClose={() => setRejectPayId(null)} onDone={() => { setRejectPayId(null); load(); }} />}
    </div>
  );
}
