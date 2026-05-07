import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, CheckCircle2, XCircle, Clock, DollarSign,
  ChevronDown, ChevronUp, RefreshCw, Loader2, MapPin,
  Phone, Mail, CreditCard, Store, Eye, EyeOff, Edit3,
  ToggleLeft, ToggleRight, AlertTriangle, ShieldAlert, Lock, LockOpen,
  Link2, Copy, FileCheck, QrCode, CheckCheck, Map,
  Building2, Save, Landmark,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/client';
import ShopMapTab from './ShopMapTab';
import ShopsByAgentTab from './ShopsByAgentTab';

const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

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
function AgentDetailPanel({ agent: initialAgent, onClose, onEdit }) {
  const [agent, setAgent]             = useState(initialAgent);
  const [customers, setCustomers]     = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [tab, setTab]                 = useState('customers');
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(new Set());
  const [paying, setPaying]           = useState(false);

  // Bank details state
  const [bankForm, setBankForm] = useState({
    bank_name:      initialAgent.bank_name      || '',
    bank_account:   initialAgent.bank_account   || '',
    bank_branch:    initialAgent.bank_branch     || '',
    account_holder: initialAgent.account_holder || '',
  });
  const [bankEditing, setBankEditing] = useState(false);
  const [bankSaving,  setBankSaving]  = useState(false);

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

  const hasBankDetails = !!(agent.bank_name && agent.bank_account && agent.account_holder);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handlePayout() {
    if (!selected.size) return toast.error('Select at least one commission');
    if (!hasBankDetails) {
      return toast.error('Agent bank details are missing - add them in the Bank Account tab before paying');
    }
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

  async function saveBankDetails(e) {
    e.preventDefault();
    setBankSaving(true);
    try {
      const { data } = await adminApi.updateAgentBankDetails(agent.id, bankForm);
      setAgent((a) => ({ ...a, ...data }));
      setBankEditing(false);
      toast.success('Bank details saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save bank details');
    } finally {
      setBankSaving(false);
    }
  }

  const TABS = ['customers', 'commissions', 'bank'];

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

        <div className="flex border-b border-gray-700 px-4 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize whitespace-nowrap flex items-center gap-1.5 ${
                tab === t ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}>
              {t === 'bank' && <Landmark className="w-3.5 h-3.5" />}
              {t === 'bank' ? 'Bank Account' : t}
              {t === 'bank' && !hasBankDetails && (
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block ml-0.5" title="Missing bank details" />
              )}
            </button>
          ))}
        </div>

        {loading && tab !== 'bank' ? (
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

        ) : tab === 'commissions' ? (
          <div className="p-4">
            {/* Bank details warning before payout */}
            {!hasBankDetails && (
              <div className="flex items-start gap-2 bg-red-900/40 border border-red-700 rounded-xl p-3 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">
                  Bank account details are missing. Add them in the <button className="underline" onClick={() => setTab('bank')}>Bank Account</button> tab before processing payouts.
                </p>
              </div>
            )}
            {/* Bank details summary for payout reference */}
            {hasBankDetails && (
              <div className="flex items-start gap-2 bg-gray-800 border border-gray-700 rounded-xl p-3 mb-3">
                <Building2 className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-300 space-y-0.5">
                  <p><span className="text-gray-500">Account:</span> {agent.account_holder} · {agent.bank_account}</p>
                  <p><span className="text-gray-500">Bank:</span> {agent.bank_name}{agent.bank_branch ? ` - ${agent.bank_branch}` : ''}</p>
                </div>
              </div>
            )}
            {approvedCommissions.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-300">
                  {selected.size > 0 ? `${selected.size} selected - LKR ${fmtMoney([...selected].reduce((s, id) => {
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

        ) : (
          /* Bank Account tab */
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-semibold text-white">Bank Account Details</h4>
              </div>
              {!bankEditing && (
                <button
                  onClick={() => setBankEditing(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-lg"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>

            {!bankEditing ? (
              hasBankDetails ? (
                <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
                  {[
                    { label: 'Account Holder', value: agent.account_holder },
                    { label: 'Bank Name',      value: agent.bank_name      },
                    { label: 'Account Number', value: agent.bank_account   },
                    { label: 'Branch',         value: agent.bank_branch || '-' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm text-white font-medium mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Building2 className="w-10 h-10 text-gray-600" />
                  <p className="text-gray-400 text-sm">No bank details on file</p>
                  <button
                    onClick={() => setBankEditing(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg"
                  >
                    Add Bank Details
                  </button>
                </div>
              )
            ) : (
              <form onSubmit={saveBankDetails} className="space-y-3">
                {[
                  { key: 'account_holder', label: 'Account Holder Name', required: true  },
                  { key: 'bank_name',      label: 'Bank Name',           required: true  },
                  { key: 'bank_account',   label: 'Account Number',      required: true  },
                  { key: 'bank_branch',    label: 'Branch',              required: false },
                ].map(({ key, label, required }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-400 mb-1">{label}{required && ' *'}</label>
                    <input
                      type="text"
                      required={required}
                      value={bankForm[key]}
                      onChange={(e) => setBankForm((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2.5 border border-gray-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setBankEditing(false)}
                    className="flex-1 py-2.5 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600">
                    Cancel
                  </button>
                  <button type="submit" disabled={bankSaving}
                    className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {bankSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              </form>
            )}
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
          <p>No agents with elevated risk - all scores are low.</p>
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

// ── Agent Document Viewer Modal ───────────────────────────────
function AgentDocModal({ agentId, onClose }) {
  const [docs,     setDocs]   = useState(null);
  const [loading,  setLd]     = useState(true);
  const [acting,   setAct]    = useState(false);
  const [reason,   setRsn]    = useState('');
  const [agrUrl,   setAgrUrl] = useState('');
  const [savingAgr, setSavingAgr] = useState(false);

  useEffect(() => {
    adminApi.getAgentDocuments(agentId)
      .then(({ data }) => setDocs(data))
      .catch(() => toast.error('Failed to load documents'))
      .finally(() => setLd(false));
  }, [agentId]);

  async function approve() {
    setAct(true);
    try {
      await adminApi.approveAgent(agentId);
      toast.success('Agent approved and activated!');
      onClose(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    } finally { setAct(false); }
  }

  async function saveAgreementUrl() {
    if (!agrUrl.trim()) return;
    setSavingAgr(true);
    try {
      await adminApi.saveSignedAgreementUrl(agentId, agrUrl.trim());
      setDocs((d) => ({ ...d, signed_agreement_url: agrUrl.trim() }));
      setAgrUrl('');
      toast.success('Signed agreement URL saved');
    } catch {
      toast.error('Failed to save URL');
    } finally { setSavingAgr(false); }
  }

  async function reject() {
    if (!reason.trim()) { toast.error('Provide a rejection reason'); return; }
    setAct(true);
    try {
      await adminApi.rejectAgent(agentId, { reason });
      toast.success('Agent registration rejected');
      onClose(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject');
    } finally { setAct(false); }
  }

  function DocLink({ label, url }) {
    if (!url) return <p className="text-xs text-gray-500">{label}: <em className="text-gray-400">Not uploaded</em></p>;
    const isDataUri = url.startsWith('data:');
    return (
      <div className="flex items-center justify-between text-xs py-1">
        <span className="text-gray-400">{label}</span>
        <a href={url} target="_blank" rel="noreferrer"
          className="text-indigo-400 underline hover:text-indigo-300 flex items-center gap-1">
          <Eye className="w-3 h-3" /> {isDataUri ? 'View (inline)' : 'Open'}
        </a>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
        ) : docs ? (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Agent Registration – {docs.name}</h2>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-gray-500">Email</p><p className="text-white">{docs.email}</p></div>
              <div><p className="text-gray-500">Phone</p><p className="text-white">{docs.phone || '-'}</p></div>
              <div><p className="text-gray-500">NIC</p><p className="text-white">{docs.nic_number || '-'}</p></div>
              <div><p className="text-gray-500">Driving License</p><p className="text-white">{docs.driving_license_number || '-'}</p></div>
              <div><p className="text-gray-500">Bank</p><p className="text-white">{docs.bank_name || '-'}</p></div>
              <div><p className="text-gray-500">Account</p><p className="text-white">{docs.bank_account || '-'}</p></div>
              <div><p className="text-gray-500">Account Holder</p><p className="text-white">{docs.account_holder || '-'}</p></div>
              <div><p className="text-gray-500">District</p><p className="text-white">{docs.district || '-'}</p></div>
            </div>

            <div className="bg-gray-800 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-300 mb-2">Documents</p>
              <DocLink label="NIC Front"          url={docs.nic_front_url} />
              <DocLink label="NIC Back"           url={docs.nic_back_url} />
              <DocLink label="Agent Photo"        url={docs.agent_photo_url} />
              <DocLink label="Bank Book"          url={docs.bank_book_url} />
              <DocLink label="Signed Agreement"   url={docs.signed_agreement_url} />
              {!docs.signed_agreement_url && (
                <div className="flex gap-2 mt-2">
                  <input
                    value={agrUrl}
                    onChange={(e) => setAgrUrl(e.target.value)}
                    placeholder="Paste Firebase URL to save…"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                  />
                  <button
                    onClick={saveAgreementUrl}
                    disabled={savingAgr || !agrUrl.trim()}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded disabled:opacity-50"
                  >
                    {savingAgr ? '…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {docs.approval_status === 'pending' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Rejection reason (required if rejecting)</label>
                  <input value={reason} onChange={(e) => setRsn(e.target.value)}
                    placeholder="e.g. Documents unclear, resubmit…"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={reject} disabled={acting}
                    className="flex-1 py-2 bg-red-800 hover:bg-red-700 text-red-100 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                    {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Reject
                  </button>
                  <button onClick={approve} disabled={acting}
                    className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                    {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
                  </button>
                </div>
              </div>
            )}

            {docs.approval_status !== 'pending' && (
              <div className={`text-center text-sm font-medium py-2 rounded-lg ${docs.approval_status === 'active' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                Status: {docs.approval_status}
                {docs.rejection_reason && <p className="text-xs mt-1 opacity-75">{docs.rejection_reason}</p>}
              </div>
            )}
          </div>
        ) : <p className="text-gray-400 text-center py-10">Failed to load</p>}

        <button onClick={() => onClose(false)} className="mt-4 w-full py-2 border border-gray-700 rounded-lg text-sm text-gray-400 hover:bg-gray-800">
          Close
        </button>
      </div>
    </div>
  );
}

// ── Invite Token Generator ────────────────────────────────────
function InviteTokenSection() {
  const [tokens,  setTokens]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [note,    setNote]    = useState('');
  const [gen,     setGen]     = useState(false);

  const load = useCallback(() => {
    adminApi.listInviteTokens()
      .then(({ data }) => setTokens(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGen(true);
    try {
      await adminApi.generateInviteToken({ note });
      toast.success('Invite link generated');
      setNote('');
      load();
    } catch {
      toast.error('Failed to generate token');
    } finally { setGen(false); }
  }

  function copyLink(token) {
    const url = `${window.location.origin}/agent/register?token=${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="font-semibold text-white text-sm mb-3">Generate Registration Invite</h3>
        <div className="flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (e.g. 'For Colombo region')"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={generate} disabled={gen}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1">
            {gen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Generate
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto" /> : tokens.map((t) => (
          <div key={t.id} className="bg-gray-800 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-gray-300 truncate">{t.token}</p>
                {t.note && <p className="text-xs text-gray-500 mt-0.5">{t.note}</p>}
                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                  <span>Expires: {new Date(t.expires_at).toLocaleDateString()}</span>
                  {t.used_at ? (
                    <span className="text-orange-400">Used by {t.used_by_name || 'unknown'}</span>
                  ) : (
                    <span className="text-green-400">Available</span>
                  )}
                </div>
              </div>
              {!t.used_at && (
                <button onClick={() => copyLink(t.token)}
                  className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-400 hover:text-white shrink-0">
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shop Payment Proofs Tab ───────────────────────────────────
function ShopPaymentsTab() {
  const [proofs,      setProofs]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('pending');
  const [acting,      setActing]      = useState(null);
  const [rejectOpen,  setRejectOpen]  = useState(null);
  const [rejectNote,  setRejectNote]  = useState('');
  const [expandedId,  setExpandedId]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.listShopPayments({ status: filter })
      .then(({ data }) => setProofs(data))
      .catch(() => toast.error('Failed to load proofs'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function verify(id, isHelaPay) {
    setActing(id);
    try {
      if (isHelaPay) {
        await adminApi.verifyHelaPay(id);
      } else {
        await adminApi.verifyShopPayment(id);
      }
      toast.success('Payment verified - shop activated & onboarding commission approved!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to verify');
    } finally { setActing(null); }
  }

  async function confirmReject(id) {
    setActing(id);
    try {
      await adminApi.rejectShopPayment(id, { admin_note: rejectNote });
      toast.success('Payment rejected');
      setRejectOpen(null); setRejectNote('');
      load();
    } catch {
      toast.error('Failed to reject');
    } finally { setActing(null); }
  }

  const statusMap = {
    pending:  { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-700' },
    verified: { label: 'Verified', cls: 'bg-green-100  text-green-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-100    text-red-700'   },
  };
  const commStatusMap = {
    pending:  'text-yellow-400', approved: 'text-blue-400',
    locked:   'text-gray-400',   paid:     'text-green-400',
  };

  const pending = proofs.filter((p) => p.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-2">
          {['pending','verified','rejected'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {s}{s === 'pending' && pending.length > 0 ? ` (${pending.length})` : ''}
            </button>
          ))}
        </div>
        {filter === 'pending' && proofs.length > 0 && (
          <p className="text-xs text-yellow-400 ml-auto">
            Verifying activates shop account and approves LKR 500 onboarding commission
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : proofs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No {filter} shop payments</div>
      ) : (
        <div className="space-y-3">
          {proofs.map((p) => {
            const isExpanded = expandedId === p.id;
            const hasAgent   = !!(p.agent_name);
            const commAmount = p.onboarding_commission_amount ? `LKR ${Number(p.onboarding_commission_amount).toLocaleString()}` : 'LKR 500';
            const commStatus = p.onboarding_commission_status;

            return (
            <div key={p.id} className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
              {/* Main row */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-white truncate">{p.shop_name}</p>
                      {p.shop_reference_id && <span className="text-xs font-mono text-gray-400">{p.shop_reference_id}</span>}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[p.status]?.cls || ''}`}>
                        {statusMap[p.status]?.label || p.status}
                      </span>
                      {p.activation_status === 'inactive' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-900 text-orange-300">Not Activated</span>
                      )}
                      {p.activation_status === 'active' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">Active</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{p.owner_name}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                      <span className="capitalize">{p.payment_method?.replace(/_/g, ' ')}</span>
                      <span>{fmtDate(p.created_at)}</span>
                      {p.amount && <span className="text-white font-semibold">LKR {Number(p.amount).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {p.shop_selfie_url && (
                      <a href={p.shop_selfie_url} target="_blank" rel="noreferrer">
                        <img src={p.shop_selfie_url} alt="Shop" className="w-14 h-14 object-cover rounded-lg border border-gray-600 hover:border-purple-400 transition-colors" />
                      </a>
                    )}
                    <button onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                {p.status === 'pending' && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700">
                    {p.proof_url && (
                      <a href={p.proof_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg">
                        <Eye className="w-3 h-3" /> View Proof
                      </a>
                    )}
                    <button onClick={() => { setRejectOpen(p.id); setRejectNote(''); }}
                      disabled={acting === p.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-300 text-xs rounded-lg disabled:opacity-50">
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                    <button onClick={() => verify(p.id, p.payment_method === 'agent_helaPay' || p.payment_method === 'helaPay')}
                      disabled={acting === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                      {acting === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                      Activate Account
                    </button>
                    {rejectOpen === p.id && (
                      <div className="w-full flex gap-2 mt-1">
                        <input type="text" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                          placeholder="Rejection reason (optional)"
                          className="flex-1 bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none" />
                        <button onClick={() => { setRejectOpen(null); setRejectNote(''); }}
                          className="px-2 py-1.5 text-xs rounded-lg bg-gray-700 text-gray-400 hover:bg-gray-600">Cancel</button>
                        <button onClick={() => confirmReject(p.id)} disabled={acting === p.id}
                          className="px-3 py-1.5 text-xs rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold disabled:opacity-50">Confirm</button>
                      </div>
                    )}
                  </div>
                )}
                {p.status !== 'pending' && (p.proof_url || p.qr_reference) && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700">
                    {p.proof_url && (
                      <a href={p.proof_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg">
                        <Eye className="w-3 h-3" /> View Proof
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded: agent info + commission */}
              {isExpanded && (
                <div className="border-t border-gray-700 p-4 space-y-4 bg-gray-750/30">
                  {/* Agent information */}
                  {hasAgent ? (
                    <div className="bg-gray-800 rounded-xl p-4">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">
                        Agent Information
                      </p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Name</p>
                          <p className="text-white font-medium">{p.agent_name}</p>
                        </div>
                        {p.agent_id_info && (
                          <div>
                            <p className="text-xs text-gray-500">Agent ID</p>
                            <p className="text-white font-mono">#{p.agent_id_info}</p>
                          </div>
                        )}
                        {p.agent_phone && (
                          <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <a href={`tel:${p.agent_phone}`} className="text-blue-400 hover:underline">{p.agent_phone}</a>
                          </div>
                        )}
                        {p.agent_email && (
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-gray-300 truncate">{p.agent_email}</p>
                          </div>
                        )}
                        {p.agent_district && (
                          <div>
                            <p className="text-xs text-gray-500">District</p>
                            <p className="text-gray-300">{p.agent_district}</p>
                          </div>
                        )}
                      </div>

                      {/* Onboarding commission */}
                      <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-400">Onboarding Commission</p>
                          <p className="text-white font-semibold">{commAmount}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Status</p>
                          <p className={`text-sm font-semibold capitalize ${commStatusMap[commStatus] || 'text-gray-400'}`}>
                            {commStatus ? (commStatus === 'locked' ? 'pending' : commStatus) : 'Will be approved on activation'}
                          </p>
                        </div>
                      </div>
                      {p.status === 'pending' && (
                        <p className="text-xs text-yellow-400 mt-2">
                          Clicking "Activate Account" will activate the shop and approve the {commAmount} onboarding commission.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-800 rounded-xl p-4 text-center text-gray-500 text-sm">
                      No agent associated with this shop
                    </div>
                  )}

                  {/* Payment details */}
                  {p.admin_note && (
                    <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
                      <p className="text-xs text-red-400">Admin note: {p.admin_note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const [tab, setTab]                   = useState('agents');
  const [agents, setAgents]             = useState([]);
  const [pending, setPending]           = useState([]);
  const [pendingReg, setPendingReg]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [agentModal, setAgentModal]     = useState(null);
  const [detailAgent, setDetailAgent]   = useState(null);
  const [rejectModal, setRejectModal]   = useState(null);
  const [verifying, setVerifying]       = useState(null);
  const [docModal,   setDocModal]       = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p, r] = await Promise.all([
        adminApi.listAgents(),
        adminApi.pendingAgentPayments(),
        adminApi.agentRegistrations(),
      ]);
      setAgents(a.data);
      setPending(p.data);
      setPendingReg(r.data);
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
      toast.success('Payment verified - shop activated & commission unlocked');
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
          { key: 'agents',       label: 'Agents'           },
          { key: 'registrations',label: `Registrations${pendingReg.length > 0 ? ` (${pendingReg.length})` : ''}` },
          { key: 'shop_payments',label: 'Shop Payments'    },
          { key: 'shops_by_agent',label: 'Shops by Agent'   },
          { key: 'shop_map',     label: 'Shop Map'         },
          { key: 'invite',       label: 'Invite Links'     },
          { key: 'payments',     label: `Cash Payments${pending.length > 0 ? ` (${pending.length})` : ''}` },
          { key: 'risk_scores',  label: 'Risk Scores'      },
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

      ) : tab === 'registrations' ? (

        /* ── Pending agent registrations ── */
        <div className="space-y-3">
          {pendingReg.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No pending agent registrations.</p>
            </div>
          ) : pendingReg.map((ag) => (
            <div key={ag.id} className="bg-gray-800 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{ag.name}</p>
                <p className="text-sm text-gray-400">{ag.email}</p>
                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                  <span>{ag.phone}</span>
                  {ag.district && <span>{ag.district}</span>}
                  <span>NIC: {ag.nic_number || '-'}</span>
                  <span>Applied: {new Date(ag.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => setDocModal(ag.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg font-medium"
              >
                <Eye className="w-3.5 h-3.5" /> Review
              </button>
            </div>
          ))}
        </div>

      ) : tab === 'shop_payments' ? (

        <ShopPaymentsTab />

      ) : tab === 'shops_by_agent' ? (

        <ShopsByAgentTab />

      ) : tab === 'shop_map' ? (

        <ShopMapTab />

      ) : tab === 'invite' ? (

        <InviteTokenSection />

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

      {docModal && (
        <AgentDocModal
          agentId={docModal}
          onClose={(refreshed) => { setDocModal(null); if (refreshed) loadData(); }}
        />
      )}
    </div>
  );
}
