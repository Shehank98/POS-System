import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, DollarSign, ShoppingCart, Package,
  BarChart2, RefreshCw, ArrowLeft, CreditCard,
  Smartphone, Banknote, MoreHorizontal, AlertTriangle,
  Layers, TrendingDown,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import toast from 'react-hot-toast';
import { analyticsApi } from '../api/client';
import useAuthStore from '../store/authStore';

/* ── helpers ─────────────────────────────────────────────────── */
const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum   = (n) => Number(n || 0).toLocaleString();
const pct      = (a, b) => (Number(b) > 0 ? ((Number(a) / Number(b)) * 100).toFixed(1) : '0.0');

function todayStr()      { return new Date().toISOString().slice(0, 10); }
function daysAgoStr(n)   { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function lastMonthRange() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last  = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

const PRESETS = [
  { label: 'Today',      start: todayStr,      end: todayStr      },
  { label: 'Yesterday',  start: () => daysAgoStr(1), end: () => daysAgoStr(1) },
  { label: '7 Days',     start: () => daysAgoStr(6), end: todayStr  },
  { label: 'This Month', start: monthStartStr,  end: todayStr      },
  { label: 'Last Month', start: () => lastMonthRange().start, end: () => lastMonthRange().end },
];

/* ── Sub-components ──────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, color, loading, highlight }) {
  const colors = {
    blue:   'bg-blue-50   text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    green:  'bg-green-50  text-green-600',
    red:    'bg-red-50    text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    gray:   'bg-gray-100  text-gray-600',
  };
  return (
    <div className={`card p-4 flex items-start gap-3 ${highlight ? 'ring-2 ring-primary-200' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color] || colors.gray}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        {loading
          ? <div className="h-7 w-24 bg-gray-100 animate-pulse rounded mt-1" />
          : <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        }
        {sub && !loading && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{fmtMoney(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const navigate = useNavigate();
  const user     = useAuthStore((s) => s.user);

  const [startDate,  setStartDate]  = useState(monthStartStr());
  const [endDate,    setEndDate]    = useState(todayStr());
  const [activePreset, setActivePreset] = useState('This Month');
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);

  const load = useCallback(async (sd = startDate, ed = endDate) => {
    setLoading(true);
    try {
      const { data: res } = await analyticsApi.get({ start_date: sd, end_date: ed });
      setData(res);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  function applyPreset(preset) {
    const sd = preset.start();
    const ed = preset.end();
    setStartDate(sd);
    setEndDate(ed);
    setActivePreset(preset.label);
    load(sd, ed);
  }

  function handleCustomRun() {
    setActivePreset('');
    load(startDate, endDate);
  }

  /* chart data */
  const chartData = (data?.daily_trend || []).map((d) => ({
    day:     new Date(d.day).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    Revenue: parseFloat(d.revenue) || 0,
  }));

  const profitColor = (n) => Number(n) >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
            <p className="text-xs text-gray-400">{user?.shop_name}</p>
          </div>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="btn-secondary text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Date range */}
      <div className="card p-4 space-y-3">
        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
                ${activePreset === p.label
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* Custom pickers */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">From</label>
            <input
              type="date"
              className="input text-sm py-1.5"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActivePreset(''); }}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To</label>
            <input
              type="date"
              className="input text-sm py-1.5"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActivePreset(''); }}
            />
          </div>
          <button
            onClick={handleCustomRun}
            disabled={loading}
            className="btn-primary text-sm py-1.5 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
            Run
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Revenue"
          value={fmtMoney(data?.total_revenue)}
          sub={data?.total_refunds > 0 ? `−${fmtMoney(data?.total_refunds)} refunds` : `Tax: ${fmtMoney(data?.total_tax)}`}
          icon={DollarSign}
          color="blue"
          loading={loading}
          highlight
        />
        <KpiCard
          label="Cost of Goods"
          value={fmtMoney(data?.total_cost)}
          sub="Cost of items sold"
          icon={ShoppingCart}
          color="orange"
          loading={loading}
        />
        <KpiCard
          label="Gross Profit"
          value={
            !loading && data
              ? <span className={profitColor(data.gross_profit)}>{fmtMoney(data.gross_profit)}</span>
              : fmtMoney(0)
          }
          sub={!loading && data?.total_revenue > 0
            ? `Margin: ${pct(data.gross_profit, data.total_revenue)}%`
            : undefined}
          icon={TrendingUp}
          color={!loading && data?.gross_profit >= 0 ? 'green' : 'red'}
          loading={loading}
          highlight
        />
        <KpiCard
          label="Transactions"
          value={fmtNum(data?.transaction_count)}
          sub={`${fmtNum(data?.items_sold)} items sold`}
          icon={Package}
          color="purple"
          loading={loading}
        />
      </div>

      {/* ── Secondary KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Net Revenue"
          value={fmtMoney(data?.net_revenue)}
          sub="After refunds"
          icon={TrendingUp}
          color="blue"
          loading={loading}
        />
        <KpiCard
          label="Tax Collected"
          value={fmtMoney(data?.total_tax)}
          icon={Layers}
          color="gray"
          loading={loading}
        />
        <KpiCard
          label="Discounts Given"
          value={fmtMoney(data?.total_discounts)}
          icon={TrendingDown}
          color="orange"
          loading={loading}
        />
        <KpiCard
          label="Avg. Transaction"
          value={fmtMoney(
            data?.transaction_count > 0
              ? data.total_revenue / data.transaction_count
              : 0
          )}
          sub="Revenue ÷ orders"
          icon={CreditCard}
          color="purple"
          loading={loading}
        />
      </div>

      {/* ── Payment Methods ── */}
      {data && (data.payment_methods.cash > 0 || data.payment_methods.card > 0 || data.payment_methods.mobile > 0) && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-400" />
            Payment Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Cash',   icon: Banknote,      val: data.payment_methods.cash,   cls: 'bg-green-50  border-green-100 text-green-700'  },
              { label: 'Card',   icon: CreditCard,    val: data.payment_methods.card,   cls: 'bg-blue-50   border-blue-100  text-blue-700'   },
              { label: 'Mobile', icon: Smartphone,    val: data.payment_methods.mobile, cls: 'bg-purple-50 border-purple-100 text-purple-700' },
              { label: 'Other',  icon: MoreHorizontal,val: data.payment_methods.other,  cls: 'bg-gray-50   border-gray-100  text-gray-600'   },
            ].map(({ label, icon: Icon, val, cls }) => (
              <div key={label} className={`rounded-xl border p-3 ${cls}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 opacity-70" />
                  <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
                </div>
                <p className="text-lg font-bold">{fmtMoney(val)}</p>
                {data.total_revenue > 0 && (
                  <p className="text-xs opacity-60 mt-0.5">{pct(val, data.total_revenue)}%</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Revenue Trend Chart ── */}
      {chartData.length > 1 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-gray-400" />
            Daily Revenue Trend
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={52} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="Revenue"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#revGrad)"
                dot={{ r: 3, fill: '#2563eb' }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top Products ── */}
      {data?.top_products?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Top Products</h3>
            <span className="ml-auto text-xs text-gray-400">Revenue · Cost · Profit</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5">#</th>
                  <th className="text-left px-4 py-2.5">Product</th>
                  <th className="text-right px-4 py-2.5">Qty</th>
                  <th className="text-right px-4 py-2.5">Revenue</th>
                  <th className="text-right px-4 py-2.5 hidden sm:table-cell">Cost</th>
                  <th className="text-right px-4 py-2.5">Profit</th>
                  <th className="text-right px-4 py-2.5 hidden md:table-cell">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.top_products.map((p, i) => {
                  const margin = Number(p.revenue) > 0
                    ? ((Number(p.profit) / Number(p.revenue)) * 100).toFixed(1)
                    : '0.0';
                  const isPositive = Number(p.profit) >= 0;
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmtNum(p.qty_sold)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(p.revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{fmtMoney(p.cost)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {fmtMoney(p.profit)}
                      </td>
                      <td className={`px-4 py-3 text-right text-xs hidden md:table-cell ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {margin}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Inventory Summary ── */}
      {data?.inventory && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            Inventory Snapshot
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Products',  value: fmtNum(data.inventory.total_products),  color: 'text-gray-900' },
              { label: 'Categories',      value: fmtNum(data.inventory.categories_count), color: 'text-blue-700' },
              { label: 'Low Stock (<10)', value: fmtNum(data.inventory.low_stock),        color: 'text-orange-600' },
              { label: 'Out of Stock',    value: fmtNum(data.inventory.out_of_stock),     color: data.inventory.out_of_stock > 0 ? 'text-red-600' : 'text-gray-400' },
              { label: 'Stock Value',     value: fmtMoney(data.inventory.stock_value),    color: 'text-green-700', sub: 'at cost price' },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
          {Number(data.inventory.out_of_stock) > 0 && (
            <div className="flex items-center gap-2 mt-3 bg-red-50 border border-red-100
                            rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {data.inventory.out_of_stock} product{data.inventory.out_of_stock > 1 ? 's' : ''} out of stock — update stock in the Products page.
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.transaction_count === 0 && (
        <div className="text-center py-12 text-gray-400 card p-8">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No sales data for the selected period</p>
          <p className="text-sm mt-1">Try selecting a wider date range</p>
        </div>
      )}
    </div>
  );
}
