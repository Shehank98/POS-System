import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet, Users, CheckCircle2, Clock, DollarSign, ChevronDown, ChevronUp,
  Loader2, Building2, Download, RefreshCw, AlertTriangle, XCircle, Filter,
  Search, CreditCard, Landmark, Check, Banknote, ArrowRight, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/client';

const fmt     = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2 });
const fmtMoney = (n) => `LKR ${fmt.format(Number(n) || 0)}`;
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const todayISO = () => new Date().toISOString().split('T')[0];

const STATUS_CHIP = {
  pending:  'bg-yellow-100 text-yellow-800',
  locked:   'bg-gray-100   text-gray-600',
  approved: 'bg-blue-100   text-blue-800',
  paid:     'bg-green-100  text-green-800',
};
const TYPE_LABEL = { onboarding: 'Onboarding', monthly: 'Monthly' };

// ── Payout modal ──────────────────────────────────────────────
function PayoutModal({ agent, commissions, onClose, onDone }) {
  const [form, setForm] = useState({
    payment_method:        'bank_transfer',
    transaction_reference: '',
    payment_date:          todayISO(),
    notes:                 '',
  });
  const [saving, setSaving] = useState(false);

  const total = commissions.reduce((s, c) => s + parseFloat(c.amount), 0);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await adminApi.payoutCommissions({
        commission_ids: commissions.map((c) => c.id),
        agent_id:       agent.id,
        ...form,
      });
      toast.success(`Marked ${data.paid_count} commission(s) as paid — ${fmtMoney(data.total_amount)}`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payout failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-700">
        <div className="p-5 border-b border-gray-700">
          <p className="font-bold text-white text-base">Mark as Paid</p>
          <p className="text-xs text-gray-400 mt-0.5">{agent.name} · {commissions.length} commission(s)</p>
        </div>

        <div className="p-5">
          {/* Summary */}
          <div className="bg-gray-800 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-300">Total payout</p>
              <p className="text-lg font-bold text-green-400">{fmtMoney(total)}</p>
            </div>
            {agent.bank_name && (
              <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400 space-y-0.5">
                <p><span className="text-gray-500">Account:</span> {agent.account_holder} · {agent.bank_account}</p>
                <p><span className="text-gray-500">Bank:</span> {agent.bank_name}{agent.bank_branch ? ` — ${agent.bank_branch}` : ''}</p>
              </div>
            )}
            {!agent.bank_name && (
              <p className="mt-2 text-xs text-red-400">⚠ No bank details on file for this agent</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Payment Method *</label>
              <select value={form.payment_method} onChange={set('payment_method')}
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2.5 border border-gray-600 focus:outline-none focus:border-indigo-500">
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Payment Date *</label>
              <input type="date" required value={form.payment_date} onChange={set('payment_date')} max={todayISO()}
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2.5 border border-gray-600 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Transaction Reference</label>
              <input type="text" value={form.transaction_reference} onChange={set('transaction_reference')}
                placeholder="e.g. TXN12345678"
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2.5 border border-gray-600 focus:outline-none focus:border-indigo-500 placeholder-gray-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea rows={2} value={form.notes} onChange={set('notes')}
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-indigo-500 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-gray-700 text-gray-300 text-sm hover:bg-gray-600">Cancel</button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm Payout
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Agent commission group card ───────────────────────────────
function AgentCommissionCard({ agent, commissions, onRefresh }) {
  const [expanded,  setExpanded]  = useState(false);
  const [selected,  setSelected]  = useState(new Set());
  const [approving, setApproving] = useState(false);
  const [payoutModal, setPayoutModal] = useState(false);

  const pending  = commissions.filter((c) => ['pending','locked'].includes(c.status));
  const approved = commissions.filter((c) => c.status === 'approved');
  const paid     = commissions.filter((c) => c.status === 'paid');

  const pendingTotal  = pending.reduce((s, c) => s + parseFloat(c.amount), 0);
  const approvedTotal = approved.reduce((s, c) => s + parseFloat(c.amount), 0);

  const selectedApproved = [...selected].filter((id) => approved.some((c) => c.id === id));

  function toggle(id) {
    setSelected((p) => {
      const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
  }
  function toggleAll(list) {
    const ids = list.map((c) => c.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((p) => {
      const n = new Set(p);
      ids.forEach((id) => allSelected ? n.delete(id) : n.add(id));
      return n;
    });
  }

  async function handleApprove() {
    const ids = [...selected].filter((id) => pending.some((c) => c.id === id));
    if (!ids.length) return toast.error('Select pending commissions to approve');
    setApproving(true);
    try {
      const { data } = await adminApi.approveCommissions({ commission_ids: ids, agent_id: agent.id });
      toast.success(`Approved ${data.approved_count} commission(s) — ${fmtMoney(data.total_amount)}`);
      setSelected(new Set());
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approve failed');
    } finally { setApproving(false); }
  }

  const hasBankDetails = !!(agent.bank_name && agent.bank_account && agent.account_holder);

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Agent header */}
      <div className="p-4 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {(agent.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white">{agent.name}</p>
            <span className="text-xs text-gray-400">{agent.district || ''}</span>
          </div>
          <p className="text-xs text-gray-500">{agent.email}{agent.phone ? ` · ${agent.phone}` : ''}</p>
          {hasBankDetails ? (
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3" />
              {agent.account_holder} · {agent.bank_account} · {agent.bank_name}
            </p>
          ) : (
            <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3" /> No bank details on file
            </p>
          )}
        </div>
        <button onClick={() => setExpanded((v) => !v)}
          className="shrink-0 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {pendingTotal > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-900/50 text-yellow-300">
            Pending: {fmtMoney(pendingTotal)} ({pending.length})
          </span>
        )}
        {approvedTotal > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-900/50 text-blue-300">
            Approved: {fmtMoney(approvedTotal)} ({approved.length})
          </span>
        )}
        {paid.length > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-900/50 text-green-300">
            Paid: {paid.length}
          </span>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 px-4 pb-4 border-t border-gray-700 pt-3">
        {pending.length > 0 && (
          <button
            onClick={() => { toggleAll(pending); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            {pending.every((c) => selected.has(c.id)) ? 'Deselect Pending' : 'Select All Pending'}
          </button>
        )}
        {[...selected].some((id) => pending.some((c) => c.id === id)) && (
          <button onClick={handleApprove} disabled={approving}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-semibold flex items-center gap-1 disabled:opacity-50">
            {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Approve Selected
          </button>
        )}
        {approved.length > 0 && (
          <>
            <button
              onClick={() => toggleAll(approved)}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              {approved.every((c) => selected.has(c.id)) ? 'Deselect Approved' : 'Select All Approved'}
            </button>
            {selectedApproved.length > 0 && (
              <button onClick={() => setPayoutModal(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white font-semibold flex items-center gap-1">
                <Banknote className="w-3 h-3" />
                Pay {selectedApproved.length} ({fmtMoney(selectedApproved.reduce((s, id) => {
                  const c = commissions.find((c) => c.id === id); return s + (c ? parseFloat(c.amount) : 0);
                }, 0))})
              </button>
            )}
          </>
        )}
        <button onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-xs text-gray-500 hover:text-gray-300">
          {expanded ? 'Hide' : 'Show'} details
        </button>
      </div>

      {/* Expanded commission list */}
      {expanded && (
        <div className="border-t border-gray-700 divide-y divide-gray-700/50">
          {commissions.map((c) => {
            const isPending  = ['pending','locked'].includes(c.status);
            const isApproved = c.status === 'approved';
            const selectable = isPending || isApproved;
            return (
              <div key={c.id}
                onClick={() => selectable && toggle(c.id)}
                className={`flex items-center gap-3 px-4 py-3 ${selectable ? 'cursor-pointer hover:bg-gray-700/50' : ''} ${selected.has(c.id) ? 'bg-indigo-900/20' : ''}`}>
                {selectable && (
                  <input type="checkbox" readOnly checked={selected.has(c.id)}
                    className="w-4 h-4 accent-indigo-500 shrink-0" />
                )}
                {!selectable && <div className="w-4 h-4 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-white truncate">{c.shop_name}</p>
                    {c.shop_activation_status && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${c.shop_activation_status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                        {c.shop_activation_status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 capitalize">
                    {TYPE_LABEL[c.commission_type] || c.commission_type}
                    {c.month ? ` · ${new Date(c.month).toLocaleDateString('en-GB', { month:'short', year:'numeric' })}` : ''}
                    {c.earned_date ? ` · Earned ${fmtDate(c.earned_date)}` : ''}
                    {c.shop_subscription_status ? ` · Sub: ${c.shop_subscription_status.replace(/_/g,' ')}` : ''}
                  </p>
                  {c.status === 'paid' && c.paid_at && (
                    <p className="text-xs text-green-500">Paid {fmtDate(c.paid_at)}
                      {c.transaction_reference ? ` · Ref: ${c.transaction_reference}` : ''}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white">{fmtMoney(c.amount)}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CHIP[c.status] || 'bg-gray-100 text-gray-600'}`}>
                    {c.status === 'locked' ? 'pending' : c.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {payoutModal && (
        <PayoutModal
          agent={agent}
          commissions={commissions.filter((c) => selectedApproved.includes(c.id))}
          onClose={() => setPayoutModal(false)}
          onDone={() => { setPayoutModal(false); setSelected(new Set()); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Payout history tab ────────────────────────────────────────
function PayoutHistoryTab() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.payoutLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load payout history'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) =>
      l.agent_name?.toLowerCase().includes(q) ||
      l.transaction_reference?.toLowerCase().includes(q)
    );
  }, [logs, search]);

  function exportCSV() {
    const rows = [
      ['Date', 'Agent', 'Amount', 'Method', 'Reference', 'Bank', 'Notes'],
      ...filtered.map((l) => [
        fmtDate(l.paid_at), l.agent_name, l.amount,
        l.payment_method || '', l.transaction_reference || '',
        `${l.bank_name || ''} ${l.bank_account || ''}`.trim(), l.notes || '',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `payout-history-${todayISO()}.csv`;
    a.click();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agent or reference…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 placeholder-gray-500" />
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded-lg">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-750 border-b border-gray-700">
            <tr>
              {['Date', 'Agent', 'Amount', 'Method', 'Reference', 'Notes'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-500 py-10">No payout records</td></tr>
            )}
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-gray-700/30">
                <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{fmtDate(l.payment_date || l.paid_at)}</td>
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{l.agent_name}</p>
                  {l.bank_name && <p className="text-xs text-gray-500">{l.account_holder} · {l.bank_account}</p>}
                </td>
                <td className="px-4 py-3 font-semibold text-green-400 whitespace-nowrap">{fmtMoney(l.amount)}</td>
                <td className="px-4 py-3 text-gray-300 capitalize">{l.payment_method?.replace(/_/g, ' ') || '—'}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{l.transaction_reference || '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{l.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="border-t border-gray-700 bg-gray-750">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-xs text-gray-400">{filtered.length} payout(s)</td>
                <td className="px-4 py-2 text-sm font-bold text-green-400">
                  {fmtMoney(filtered.reduce((s, l) => s + parseFloat(l.amount), 0))}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && <p className="text-center text-gray-500 py-10">No payout records</p>}
        {filtered.map((l) => (
          <div key={l.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{l.agent_name}</p>
                <p className="text-xs text-gray-400">{fmtDate(l.payment_date || l.paid_at)}</p>
              </div>
              <p className="font-bold text-green-400 shrink-0">{fmtMoney(l.amount)}</p>
            </div>
            {l.bank_name && <p className="text-xs text-gray-500 mt-1">{l.account_holder} · {l.bank_account} · {l.bank_name}</p>}
            <div className="flex gap-3 mt-2 text-xs text-gray-400">
              <span className="capitalize">{l.payment_method?.replace(/_/g, ' ') || 'bank transfer'}</span>
              {l.transaction_reference && <span>Ref: {l.transaction_reference}</span>}
            </div>
            {l.notes && <p className="text-xs text-gray-500 mt-1 italic">{l.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function CommissionManagementPage() {
  const [commissions, setCommissions] = useState([]);
  const [agents,      setAgents]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('pending');   // pending | approved | all | history
  const [agentFilter, setAgentFilter] = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: comm }, { data: ag }] = await Promise.all([
        adminApi.agentCommissions(),
        adminApi.listAgents(),
      ]);
      setCommissions(Array.isArray(comm) ? comm : []);
      setAgents(Array.isArray(ag) ? ag : []);
    } catch { toast.error('Failed to load commissions'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter commissions by tab
  const visibleCommissions = useMemo(() => {
    let list = commissions;
    if (tab === 'pending')  list = list.filter((c) => ['pending','locked'].includes(c.status));
    if (tab === 'approved') list = list.filter((c) => c.status === 'approved');
    if (agentFilter) list = list.filter((c) => String(c.agent_id) === agentFilter);
    if (typeFilter)  list = list.filter((c) => c.commission_type === typeFilter);
    return list;
  }, [commissions, tab, agentFilter, typeFilter]);

  // Group by agent
  const grouped = useMemo(() => {
    const map = new Map();
    visibleCommissions.forEach((c) => {
      if (!map.has(c.agent_id)) map.set(c.agent_id, []);
      map.get(c.agent_id).push(c);
    });
    // Sort groups: most pending value first
    return [...map.entries()]
      .map(([agentId, comms]) => {
        const agentInfo = agents.find((a) => a.id === agentId) || {
          id: agentId, name: comms[0]?.agent_name || `Agent #${agentId}`,
          bank_name: comms[0]?.bank_name, bank_account: comms[0]?.bank_account,
          bank_branch: comms[0]?.bank_branch, account_holder: comms[0]?.account_holder,
          email: '', phone: '', district: '',
        };
        return { agentId, agentInfo, comms };
      })
      .sort((a, b) => {
        const sumPending = (list) => list.reduce((s, c) => s + (['pending','locked','approved'].includes(c.status) ? parseFloat(c.amount) : 0), 0);
        return sumPending(b.comms) - sumPending(a.comms);
      });
  }, [visibleCommissions, agents]);

  // Summary stats
  const stats = useMemo(() => {
    const pending  = commissions.filter((c) => ['pending','locked'].includes(c.status));
    const approved = commissions.filter((c) => c.status === 'approved');
    const paid     = commissions.filter((c) => c.status === 'paid');
    return {
      pendingCount:  pending.length,
      pendingAmount: pending.reduce((s, c) => s + parseFloat(c.amount), 0),
      approvedCount: approved.length,
      approvedAmount:approved.reduce((s, c) => s + parseFloat(c.amount), 0),
      paidAmount:    paid.reduce((s, c) => s + parseFloat(c.amount), 0),
    };
  }, [commissions]);

  function exportAllCSV() {
    const rows = [
      ['Agent', 'Shop', 'Type', 'Amount', 'Status', 'Earned Date', 'Paid Date', 'Method', 'Reference'],
      ...commissions.map((c) => [
        c.agent_name, c.shop_name, c.commission_type, c.amount, c.status,
        c.earned_date ? fmtDate(c.earned_date) : '',
        c.paid_at ? fmtDate(c.paid_at) : '',
        c.payment_method || '',
        c.transaction_reference || '',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v||'').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `commissions-${todayISO()}.csv`;
    a.click();
  }

  const TABS = [
    { id: 'pending',  label: 'Pending',  count: stats.pendingCount  },
    { id: 'approved', label: 'Approved', count: stats.approvedCount },
    { id: 'all',      label: 'All',      count: commissions.length  },
    { id: 'history',  label: 'History'                              },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-6 h-6 text-indigo-400" /> Commission Management
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Approve and pay agent commissions</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={exportAllCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-200">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-yellow-900/40 border border-yellow-700/50 rounded-xl p-4">
            <p className="text-xs text-yellow-300">Pending</p>
            <p className="text-2xl font-bold text-yellow-200 mt-1">{fmtMoney(stats.pendingAmount)}</p>
            <p className="text-xs text-yellow-400 mt-0.5">{stats.pendingCount} commissions</p>
          </div>
          <div className="bg-blue-900/40 border border-blue-700/50 rounded-xl p-4">
            <p className="text-xs text-blue-300">Approved (ready to pay)</p>
            <p className="text-2xl font-bold text-blue-200 mt-1">{fmtMoney(stats.approvedAmount)}</p>
            <p className="text-xs text-blue-400 mt-0.5">{stats.approvedCount} commissions</p>
          </div>
          <div className="bg-green-900/40 border border-green-700/50 rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-green-300">Total Paid (all time)</p>
            <p className="text-2xl font-bold text-green-200 mt-1">{fmtMoney(stats.paidAmount)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                tab === t.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === t.id ? 'bg-indigo-700 text-indigo-100' : 'bg-gray-700 text-gray-300'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'history' ? (
          <PayoutHistoryTab />
        ) : loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
        ) : (
          <>
            {/* Filters */}
            {(agents.length > 1 || typeFilter) && (
              <div className="flex flex-wrap gap-2">
                <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
                  <option value="">All Agents</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
                  <option value="">All Types</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="monthly">Monthly</option>
                </select>
                {(agentFilter || typeFilter) && (
                  <button onClick={() => { setAgentFilter(''); setTypeFilter(''); }}
                    className="text-xs text-gray-400 hover:text-gray-200 px-2">Clear filters</button>
                )}
              </div>
            )}

            {/* Grouped agent cards */}
            {grouped.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No commissions in this view</p>
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map(({ agentId, agentInfo, comms }) => (
                  <AgentCommissionCard
                    key={agentId}
                    agent={agentInfo}
                    commissions={comms}
                    onRefresh={load}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
