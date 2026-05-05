import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Loader2, RefreshCw, ChevronDown, ChevronRight, Download,
  Store, Wallet, Clock, CheckCircle2, XCircle, MapPin,
  Phone, Mail, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { adminApi } from '../../api/client';

// ── Helpers ───────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2 });
const fmtMoney  = (v) => `LKR ${fmt.format(Number(v) || 0)}`;
const fmtDate   = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

function StatusPill({ activation, subscription }) {
  if (activation === 'inactive') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-900/60 text-orange-300">Inactive</span>;
  }
  const map = {
    active:          'bg-green-900/60 text-green-300',
    pending_payment: 'bg-yellow-900/60 text-yellow-300',
    expired:         'bg-red-900/60 text-red-300',
    suspended:       'bg-gray-700 text-gray-400',
  };
  const label = {
    active:'Active', pending_payment:'Pending Pmt', expired:'Expired', suspended:'Suspended',
  };
  const cls = map[subscription] || map.suspended;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label[subscription] || subscription}</span>;
}

// ── CSV export ────────────────────────────────────────────────
function exportCSV(rows) {
  const headers = [
    'Agent ID','Agent Name','Agent Email','Agent Phone','Agent District',
    'Shop ID','Shop Ref','Shop Name','Owner Name','Contact',
    'Activation','Subscription','Subscription End',
    'Location','Onboarded On','Commission Earned (LKR)','Commission Pending (LKR)',
  ];

  const csvRows = [headers];
  rows.forEach((agent) => {
    if (!agent.shops.length) {
      csvRows.push([
        agent.id, agent.name, agent.email, agent.phone || '', agent.district || '',
        '','','','','','','','','','','','',
      ]);
    } else {
      agent.shops.forEach((s) => {
        csvRows.push([
          agent.id, agent.name, agent.email, agent.phone || '', agent.district || '',
          s.id, s.shop_reference_id || '', s.name, s.owner_name, s.contact_number || '',
          s.activation_status, s.subscription_status, fmtDate(s.subscription_end_date),
          s.location_map_url || '',
          fmtDate(s.created_at),
          Number(s.earned).toFixed(2),
          Number(s.pending).toFixed(2),
        ]);
      });
    }
  });

  const escaped = csvRows.map((r) =>
    r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\r\n');

  const blob = new URL(`data:text/csv;charset=utf-8,${encodeURIComponent(escaped)}`);
  const a = document.createElement('a');
  a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(escaped)}`;
  a.download = `shops-by-agent-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ── Sort control ──────────────────────────────────────────────
function SortBtn({ field, current, dir, onSort }) {
  const active = current === field;
  return (
    <button onClick={() => onSort(field)}
      className="inline-flex items-center gap-0.5 hover:text-indigo-300 transition-colors">
      {active
        ? (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
        : <ArrowUpDown className="w-3 h-3 opacity-40" />}
    </button>
  );
}

// ── Agent row (collapsible) ───────────────────────────────────
function AgentRow({ agent, searchShop }) {
  const [open, setOpen] = useState(false);

  const filteredShops = useMemo(() => {
    if (!searchShop) return agent.shops;
    const q = searchShop.toLowerCase();
    return agent.shops.filter((s) =>
      s.name?.toLowerCase().includes(q) ||
      s.owner_name?.toLowerCase().includes(q) ||
      s.shop_reference_id?.toLowerCase().includes(q)
    );
  }, [agent.shops, searchShop]);

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Agent header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-750 transition-colors"
      >
        <div className="flex-1 min-w-0">
          {/* Name + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{agent.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              agent.approval_status === 'active'
                ? 'bg-green-900/60 text-green-300'
                : agent.approval_status === 'pending'
                ? 'bg-yellow-900/60 text-yellow-300'
                : 'bg-gray-700 text-gray-400'
            }`}>{agent.approval_status}</span>
            {!agent.is_active && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-900/50 text-red-400">Deactivated</span>
            )}
          </div>

          {/* Contact */}
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{agent.email}</span>
            {agent.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{agent.phone}</span>}
            {agent.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{agent.district}</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-center hidden sm:block">
            <p className="text-lg font-bold text-white">{agent.shop_count}</p>
            <p className="text-xs text-gray-500">Shops</p>
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-sm font-bold text-green-400">{fmtMoney(agent.earned_commission)}</p>
            <p className="text-xs text-gray-500">Earned</p>
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-sm font-bold text-yellow-400">{fmtMoney(agent.pending_commission)}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          {open
            ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        </div>
      </button>

      {/* Mobile stats bar */}
      <div className="sm:hidden flex border-t border-gray-700 divide-x divide-gray-700">
        <div className="flex-1 py-2 text-center">
          <p className="text-sm font-bold text-white">{agent.shop_count}</p>
          <p className="text-xs text-gray-500">Shops</p>
        </div>
        <div className="flex-1 py-2 text-center">
          <p className="text-xs font-bold text-green-400">{fmtMoney(agent.earned_commission)}</p>
          <p className="text-xs text-gray-500">Earned</p>
        </div>
        <div className="flex-1 py-2 text-center">
          <p className="text-xs font-bold text-yellow-400">{fmtMoney(agent.pending_commission)}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </div>
      </div>

      {/* Shop breakdown */}
      {open && (
        <div className="border-t border-gray-700">
          {filteredShops.length === 0 ? (
            <p className="text-xs text-gray-500 px-5 py-4">
              {agent.shops.length === 0 ? 'No shops registered yet.' : 'No shops match the search.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-500 bg-gray-900/40">
                    <th className="text-left px-5 py-2.5 font-medium">Shop</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Owner</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Contact</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Earned</th>
                    <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Pending</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Onboarded</th>
                    <th className="px-4 py-2.5 hidden lg:table-cell"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/60">
                  {filteredShops.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-white truncate max-w-[180px]">{s.name}</p>
                        {s.shop_reference_id && (
                          <p className="font-mono text-gray-500 text-[11px]">{s.shop_reference_id}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300 hidden md:table-cell">
                        <p className="truncate max-w-[140px]">{s.owner_name}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                        {s.contact_number || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill activation={s.activation_status} subscription={s.subscription_status} />
                        {s.subscription_end_date && s.subscription_status === 'active' && (
                          <p className="text-gray-500 text-[11px] mt-0.5">Exp: {fmtDate(s.subscription_end_date)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-green-400 font-medium hidden sm:table-cell">
                        {fmtMoney(s.earned)}
                      </td>
                      <td className="px-4 py-3 text-right text-yellow-400 font-medium hidden sm:table-cell">
                        {fmtMoney(s.pending)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{fmtDate(s.created_at)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {s.location_map_url && (
                          <a href={s.location_map_url} target="_blank" rel="noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 underline">Map</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────
export default function ShopsByAgentTab() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Filters
  const [searchAgent, setSearchAgent]   = useState('');
  const [searchShop,  setSearchShop]    = useState('');
  const [filterDist,  setFilterDist]    = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');  // active | inactive | all

  // Sort
  const [sortField, setSortField] = useState('shop_count');
  const [sortDir,   setSortDir]   = useState('desc');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await adminApi.shopsByAgent();
      setRows(Array.isArray(data) ? data : []);
    } catch { setError('Failed to load data'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // District list from actual data
  const districts = useMemo(() => {
    const s = new Set(rows.map((r) => r.district).filter(Boolean));
    return [...s].sort();
  }, [rows]);

  // Filter agents
  const filtered = useMemo(() => {
    let list = rows;
    if (searchAgent) {
      const q = searchAgent.toLowerCase();
      list = list.filter((a) =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.district?.toLowerCase().includes(q)
      );
    }
    if (filterDist !== 'all') list = list.filter((a) => a.district === filterDist);
    if (filterStatus === 'has_shops')    list = list.filter((a) => Number(a.shop_count) > 0);
    if (filterStatus === 'no_shops')     list = list.filter((a) => Number(a.shop_count) === 0);
    if (filterStatus === 'has_inactive') list = list.filter((a) => Number(a.inactive_shops) > 0);
    return list;
  }, [rows, searchAgent, filterDist, filterStatus]);

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let va, vb;
      if (sortField === 'name')               { va = a.name; vb = b.name; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
      if (sortField === 'shop_count')         { va = Number(a.shop_count);         vb = Number(b.shop_count); }
      if (sortField === 'earned_commission')  { va = Number(a.earned_commission);  vb = Number(b.earned_commission); }
      if (sortField === 'pending_commission') { va = Number(a.pending_commission); vb = Number(b.pending_commission); }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  const onSort = (field) => {
    if (field === sortField) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Totals
  const totals = useMemo(() => ({
    agents:  rows.length,
    shops:   rows.reduce((s, a) => s + Number(a.shop_count), 0),
    active:  rows.reduce((s, a) => s + Number(a.active_shops), 0),
    earned:  rows.reduce((s, a) => s + Number(a.earned_commission), 0),
    pending: rows.reduce((s, a) => s + Number(a.pending_commission), 0),
  }), [rows]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">Shops by Agent</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {totals.agents} agents · {totals.shops} shops · {totals.active} active
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-lg disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => exportCSV(sorted)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded-lg">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Shops',    value: totals.shops,              color: 'text-blue-300' },
          { label: 'Active Shops',   value: totals.active,             color: 'text-green-400' },
          { label: 'Total Earned',   value: fmtMoney(totals.earned),   color: 'text-green-400' },
          { label: 'Total Pending',  value: fmtMoney(totals.pending),  color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-800 border border-gray-700 rounded-xl p-3 sm:p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-base sm:text-lg font-bold truncate ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-wrap gap-2">
        <input
          value={searchAgent}
          onChange={(e) => setSearchAgent(e.target.value)}
          placeholder="Search agent…"
          className="flex-1 min-w-[160px] bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
        />
        <input
          value={searchShop}
          onChange={(e) => setSearchShop(e.target.value)}
          placeholder="Filter shops within…"
          className="flex-1 min-w-[160px] bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
        />
        <select value={filterDist} onChange={(e) => setFilterDist(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="all">All Districts</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="all">All Agents</option>
          <option value="has_shops">Has Shops</option>
          <option value="no_shops">No Shops Yet</option>
          <option value="has_inactive">Has Inactive Shops</option>
        </select>
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-4 text-xs text-gray-500 border-b border-gray-700 pb-2">
        <span>Sort by:</span>
        {[
          { field:'shop_count',         label:'Shops'    },
          { field:'earned_commission',  label:'Earned'   },
          { field:'pending_commission', label:'Pending'  },
          { field:'name',               label:'Name'     },
        ].map(({ field, label }) => (
          <button key={field} onClick={() => onSort(field)}
            className={`flex items-center gap-1 hover:text-indigo-300 transition-colors ${sortField === field ? 'text-indigo-400 font-medium' : ''}`}>
            {label}
            <SortBtn field={field} current={sortField} dir={sortDir} onSort={onSort} />
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : error ? (
        <p className="text-center text-red-400 py-12">{error}</p>
      ) : sorted.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No agents match the current filters</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((agent) => (
            <AgentRow key={agent.id} agent={agent} searchShop={searchShop} />
          ))}
        </div>
      )}
    </div>
  );
}
