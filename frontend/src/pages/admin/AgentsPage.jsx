import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, CheckCircle2, XCircle, Clock, DollarSign,
  ChevronDown, ChevronUp, RefreshCw, Loader2, MapPin,
  Phone, Mail, CreditCard, Store, Eye, EyeOff, Edit3,
  ToggleLeft, ToggleRight, AlertTriangle, ShieldAlert, Lock, LockOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/client';

const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const PAYMENT_STATUS = {
  pending_verification: { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-700' },
  verified:             { label: 'Verified', cls: 'bg-green-100  text-green-700'  },
  rejected:             { label: 'Rejected', cls: 'bg-red-100    text-red-700'    },
};

const COMMISSION_STATUS = {
  locked:   { label: 'Locked',   cls: 'bg-gray-100   text-gray-600'  },
  approved: { label: 'Approved', cls: 'bg-green-100  text-green-700' },
  paid:     { label: 'Paid',     cls: 'bg-blue-100   text-blue-700'  },
};

const SUB_STATUS = {
  active:    { label: 'Active',    cls: 'bg-green-100  text-green-700' },
  trial:     { label: 'Trial',     cls: 'bg-blue-100   text-blue-700'  },
  expired:   { label: 'Expired',   cls: 'bg-red-100    text-red-700'   },
  suspended: { label: 'Suspended', cls: 'bg-gray-100   text-gray-600'  },
};

function Badge({ status, map }) {
  const cfg = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>;
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

// ── Agent form modal ──────────────────────────────────────────
function AgentModal({ agent, onClose, onSaved }) {
  const [form, setForm]   = useState({
    name: agent?.name || '', email: agent?.email || '',
    phone: agent?.phone || '', district: agent?.district || '',
    monthly_target: agent?.monthly_target || 0, password: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (agent) {
        await adminApi.updateAgent(agent.id, payload);
        toast.success('Agent updated');
      } else {
        await adminApi.createAgent(payload);
        toast.success('Agent created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">{agent ? 'Edit Agent' : 'New Sales Agent'}</h3>
        <form onSubmit={submit} className="space-y-3">
          {[
            { key: 'name',   label: 'Full Name',   type: 'text',   required: true  },
            { key: 'email',  label: 'Email',        type: 'email',  required: !agent },
            { key: 'phone',  label: 'Phone',        type: 'tel',    required: false },
            { key: 'district', label: 'District',   type: 'text',   required: false },
            { key: 'monthly_target', label: 'Monthly Target (shops)', type: 'number', required: false },
            { key: 'password', label: agent ? 'New Password (leave blank to keep)' : 'Password', type: 'password', required: !agent },
          ].map(({ key, label, type, required }) => (
            <div key={key}>
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              <input
                type={type}
                required={required}
                value={form[key]}
                onChange={(e) => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
                disabled={key === 'email' && !!agent}
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600
                           focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {agent ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reject payment modal ──────────────────────────────────────
function RejectPaymentModal({ submissionId, onClose, onDone }) {
  const [note, setNote]     = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await adminApi.rejectAgentPayment(submissionId, { admin_note: note });
      toast.success('Payment rejected');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-white mb-3">Reject Payment</h3>
        <textarea
          rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Reason (optional)"
          className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 resize-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm flex items-center justify-center gap-1 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agent detail drawer ───────────────────────────────────────
function AgentDetailPanel({ agent, onClose, onEdit }) {
  const [customers, setCustomers]     = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [tab, setTab]                 = useState('customers');
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(new Set());
  const [paying, setPaying]           = useState(false);

  useEffect(() => {
    Promise.all([
      adminApi.getAgentCustomers(agent.id),
      adminApi.agentCommissions({ agent_id: agent.id }),
    ]).then(([c, co]) => {
      setCustomers(c.data);
      setCommissions(co.data);
    }).finally(() => setLoading(false));
  }, [agent.id]);

  const approvedCommissions = commissions.filter((c) => c.status === 'approved');
  const approvedTotal       = approvedCommissions.reduce((s, c) => s + parseFloat(c.amount), 0);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handlePayout() {
    if (!selected.size) return toast.error('Select at least one commission');
    setPaying(true);
    try {
      const { data } = await adminApi.payoutCommissions({ commission_ids: [...selected], agent_id: agent.id });
      toast.success(`Paid LKR ${fmtMoney(data.total_amount)} for ${data.paid_count} commission(s)`);
      const updated = await adminApi.agentCommissions({ agent_id: agent.id });
      setCommissions(updated.data);
      setSelected(new Set());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payout failed');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/50" />
      <div className="w-full max-w-lg bg-gray-900 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-700 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{agent.name}</h3>
            <p className="text-xs text-gray-400">{agent.district || 'No district'} · {agent.email}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-4">
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-white">{agent.total_customers || 0}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-green-400">{agent.active_customers || 0}</p>
            <p className="text-xs text-gray-400">Active</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-indigo-400">LKR {fmtMoney(agent.approved_commissions)}</p>
            <p className="text-xs text-gray-400">Approved</p>
          </div>
        </div>

        <div className="flex border-b border-gray-700 px-4">
          {['customers', 'commissions'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
        ) : tab === 'customers' ? (
          <div className="p-4 space-y-2">
            {customers.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No customers yet</p>}
            {customers.map((s) => (
              <div key={s.id} className="bg-gray-800 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{s.name}</p>
                  <Badge status={s.subscription_status} map={SUB_STATUS} />
                </div>
                <p className="text-xs text-gray-400">{s.owner_name} · {s.email}</p>
                {s.subscription_end_date && (
                  <p className="text-xs text-gray-500 mt-0.5">Expires: {fmtDate(s.subscription_end_date)}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            {approvedCommissions.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-300">
                  {selected.size > 0 ? `${selected.size} selected — LKR ${fmtMoney([...selected].reduce((s, id) => {
                    const c = commissions.find((c) => c.id === id);
                    return s + (c ? parseFloat(c.amount) : 0);
                  }, 0))}` : `${approvedCommissions.length} approved · LKR ${fmtMoney(approvedTotal)}`}
                </p>
                <button onClick={handlePayout} disabled={!selected.size || paying}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded-lg disabled:opacity-40 flex items-center gap-1">
                  {paying && <Loader2 className="w-3 h-3 animate-spin" />} Mark Paid
                </button>
              </div>
            )}
            <div className="space-y-2">
              {commissions.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No commissions yet</p>}
              {commissions.map((c) => (
                <div key={c.id} className={`bg-gray-800 rounded-xl p-3 flex items-center gap-3 cursor-pointer
                  ${c.status === 'approved' ? 'hover:bg-gray-750' : ''}`}
                  onClick={() => c.status === 'approved' && toggleSelect(c.id)}>
                  {c.status === 'approved' && (
                    <input type="checkbox" readOnly checked={selected.has(c.id)}
                      className="w-4 h-4 accent-indigo-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.shop_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{c.commission_type}
                      {c.month ? ` · ${new Date(c.month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">LKR {fmtMoney(c.amount)}</p>
                    <Badge status={c.status} map={COMMISSION_STATUS} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
// ── Risk level helpers ────────────────────────────────────────
const RISK_BADGE = {
  low:      { label: 'Low',      cls: 'bg-green-900  text-green-300'  },
  medium:   { label: 'Medium',   cls: 'bg-yellow-900 text-yellow-300' },
  high:     { label: 'High',     cls: 'bg-orange-900 text-orange-300' },
  critical: { label: 'Critical', cls: 'bg-red-900    text-red-300'    },
};
const RISK_BAR = {
  low:      'bg-green-500',
  medium:   'bg-yellow-500',
  high:     'bg-orange-500',
  critical: 'bg-red-500',
};

function RiskScoresTab({ onAgentUpdated }) {
  const [scores,  setScores]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listRiskScores();
      setScores(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load risk scores'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRecalculate(agentId) {
    setBusy(`calc-${agentId}`);
    try {
      await adminApi.recalculateRisk(agentId);
      toast.success('Risk score recalculated');
      load();
      onAgentUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to recalculate');
    } finally { setBusy(null); }
  }

  async function handleToggleRestriction(agent) {
    const willRestrict = !agent.is_restricted;
    setBusy(`restrict-${agent.agent_id}`);
    try {
      await adminApi.setAgentRestriction(agent.agent_id, {
        restrict: willRestrict,
        reason: willRestrict ? 'Manually restricted by admin' : null,
      });
      toast.success(willRestrict ? 'Agent restricted' : 'Restriction lifted');
      load();
      onAgentUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update restriction');
    } finally { setBusy(null); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;

  const risky     = scores.filter((s) => s.risk_level !== 'low');
  const allLow    = risky.length === 0;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {(['low','medium','high','critical']).map((level) => {
          const count = scores.filter((s) => s.risk_level === level).length;
          const badge = RISK_BADGE[level];
          return (
            <div key={level} className="bg-gray-800 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${badge.cls.split(' ')[1]}`}>{count}</p>
              <p className="text-xs text-gray-400 mt-0.5">{badge.label} Risk</p>
            </div>
          );
        })}
      </div>

      {allLow && (
        <div className="text-center py-12 text-gray-400">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No agents with elevated risk — all scores are low.</p>
        </div>
      )}

      {risky.map((s) => {
        const badge = RISK_BADGE[s.risk_level] || RISK_BADGE.low;
        const bar   = RISK_BAR[s.risk_level]   || RISK_BAR.low;
        return (
          <div key={s.agent_id} className={`bg-gray-800 rounded-2xl p-4 border ${s.is_restricted ? 'border-red-700' : 'border-gray-700'}`}>
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm
                               ${s.is_restricted ? 'bg-red-700' : 'bg-indigo-600'}`}>
                {(s.name || '?').charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-white">{s.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                    {badge.label} Risk
                  </span>
                  {s.is_restricted && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-red-900 text-red-300 font-medium">
                      Restricted
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{s.email}</p>

                {/* Score bar */}
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-2 rounded-full ${bar}`} style={{ width: `${s.risk_score}%` }} />
                  </div>
                  <span className="text-xs text-gray-300 font-mono w-14 text-right shrink-0">
                    {s.risk_score}/100
                  </span>
                </div>

                {/* Metric pills */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {s.payment_mismatches_count > 0 && (
                    <span className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full">
                      {s.payment_mismatches_count} mismatch{s.payment_mismatches_count > 1 ? 'es' : ''}
                    </span>
                  )}
                  {s.partial_payments_count > 0 && (
                    <span className="text-xs bg-orange-900/60 text-orange-300 px-2 py-0.5 rounded-full">
                      {s.partial_payments_count} partial
                    </span>
                  )}
                  {s.rejected_payments_count > 0 && (
                    <span className="text-xs bg-yellow-900/60 text-yellow-300 px-2 py-0.5 rounded-full">
                      {s.rejected_payments_count} rejected
                    </span>
                  )}
                  {s.fraud_flags_count > 0 && (
                    <span className="text-xs bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded-full">
                      {s.fraud_flags_count} flag{s.fraud_flags_count > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {s.restriction_reason && (
                  <p className="text-xs text-red-400 mt-1.5">{s.restriction_reason}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => handleRecalculate(s.agent_id)}
                  disabled={busy === `calc-${s.agent_id}`}
                  className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50"
                  title="Recalculate score"
                >
                  {busy === `calc-${s.agent_id}`
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <RefreshCw className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleToggleRestriction(s)}
                  disabled={busy === `restrict-${s.agent_id}`}
                  className={`p-2 rounded-lg disabled:opacity-50 transition-colors ${
                    s.is_restricted
                      ? 'bg-green-900 hover:bg-green-800 text-green-300'
                      : 'bg-red-900 hover:bg-red-800 text-red-300'
                  }`}
                  title={s.is_restricted ? 'Lift restriction' : 'Restrict agent'}
                >
                  {busy === `restrict-${s.agent_id}`
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : s.is_restricted
                    ? <LockOpen className="w-4 h-4" />
                    : <Lock className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AgentsPage() {
  const [tab, setTab]                   = useState('agents');
  const [agents, setAgents]             = useState([]);
  const [pending, setPending]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [agentModal, setAgentModal]     = useState(null); // null | 'new' | agent object
  const [detailAgent, setDetailAgent]   = useState(null);
  const [rejectModal, setRejectModal]   = useState(null);
  const [verifying, setVerifying]       = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p] = await Promise.all([
        adminApi.listAgents(),
        adminApi.pendingAgentPayments(),
      ]);
      setAgents(a.data);
      setPending(p.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleVerify(id) {
    setVerifying(id);
    try {
      await adminApi.verifyAgentPayment(id);
      toast.success('Payment verified — shop activated & commission unlocked');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to verify');
    } finally {
      setVerifying(null);
    }
  }

  async function handleToggleActive(agent) {
    try {
      await adminApi.updateAgent(agent.id, { is_active: !agent.is_active });
      toast.success(`Agent ${agent.is_active ? 'deactivated' : 'activated'}`);
      loadData();
    } catch {
      toast.error('Failed to update');
    }
  }

  const totalActive   = agents.filter((a) => a.is_active).length;
  const totalCustomers = agents.reduce((s, a) => s + parseInt(a.total_customers || 0), 0);
  const totalApproved  = agents.reduce((s, a) => s + parseFloat(a.approved_commissions || 0), 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Agents</h1>
          <p className="text-sm text-gray-400">District-based agent network management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setAgentModal('new')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium">
            <UserPlus className="w-4 h-4" /> Add Agent
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Agents"       value={agents.length}   icon={Users}        color="bg-indigo-600" />
        <StatCard label="Active Agents"      value={totalActive}     icon={CheckCircle2} color="bg-green-600"  />
        <StatCard label="Shops Onboarded"    value={totalCustomers}  icon={Store}        color="bg-blue-600"   />
        <StatCard label="Pending Payments"   value={pending.length}  icon={Clock}        color={pending.length > 0 ? 'bg-yellow-600' : 'bg-gray-600'} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-5 overflow-x-auto">
        {[
          { key: 'agents',      label: 'Agents'           },
          { key: 'payments',    label: `Pending Payments${pending.length > 0 ? ` (${pending.length})` : ''}` },
          { key: 'risk_scores', label: 'Risk Scores' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : tab === 'agents' ? (

        /* ── Agents list ── */
        <div className="space-y-3">
          {agents.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No agents yet. Add your first sales agent.</p>
            </div>
          )}
          {agents.map((agent) => (
            <div key={agent.id} className="bg-gray-800 rounded-2xl p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{agent.name}</p>
                    {!agent.is_active && <span className="px-2 py-0.5 rounded-full text-xs bg-red-900 text-red-300">Inactive</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Mail className="w-3 h-3" />{agent.email}
                    </span>
                    {agent.phone && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" />{agent.phone}
                      </span>
                    )}
                    {agent.district && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{agent.district}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    <span><strong className="text-white">{agent.total_customers || 0}</strong> shops</span>
                    <span><strong className="text-green-400">{agent.active_customers || 0}</strong> active</span>
                    <span>Target: <strong className="text-white">{agent.monthly_target}</strong>/mo</span>
                    <span>Approved: <strong className="text-indigo-300">LKR {fmtMoney(agent.approved_commissions)}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setDetailAgent(agent)} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => setAgentModal(agent)} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleActive(agent)} title={agent.is_active ? 'Deactivate' : 'Activate'}
                    className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400">
                    {agent.is_active
                      ? <ToggleRight className="w-4 h-4 text-green-400" />
                      : <ToggleLeft  className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

      ) : tab === 'risk_scores' ? (

        <RiskScoresTab onAgentUpdated={loadData} />

      ) : (

        /* ── Pending payments ── */
        <div className="space-y-3">
          {pending.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No pending cash payments to review.</p>
            </div>
          )}
          {pending.map((sub) => (
            <div key={sub.id} className="bg-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-white">{sub.shop_name}</p>
                    <span className="text-xs text-gray-400">({sub.owner_name})</span>
                    <Badge status={sub.status} map={PAYMENT_STATUS} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />Agent: {sub.agent_name}</span>
                    {sub.agent_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{sub.agent_phone}</span>}
                    <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" />{sub.payment_method.toUpperCase()}</span>
                    <span>{fmtDate(sub.payment_date)}</span>
                  </div>
                  {sub.notes && <p className="text-xs text-gray-500 mt-1 italic">"{sub.notes}"</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-white">LKR {fmtMoney(sub.amount)}</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setRejectModal(sub.id)}
                      className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-300 text-xs rounded-lg flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button onClick={() => handleVerify(sub.id)} disabled={verifying === sub.id}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded-lg flex items-center gap-1 disabled:opacity-50">
                      {verifying === sub.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {agentModal && (
        <AgentModal
          agent={agentModal === 'new' ? null : agentModal}
          onClose={() => setAgentModal(null)}
          onSaved={() => { setAgentModal(null); loadData(); }}
        />
      )}

      {rejectModal && (
        <RejectPaymentModal
          submissionId={rejectModal}
          onClose={() => setRejectModal(null)}
          onDone={() => { setRejectModal(null); loadData(); }}
        />
      )}

      {detailAgent && (
        <AgentDetailPanel
          agent={detailAgent}
          onClose={() => setDetailAgent(null)}
          onEdit={() => { setAgentModal(detailAgent); setDetailAgent(null); }}
        />
      )}
    </div>
  );
}
