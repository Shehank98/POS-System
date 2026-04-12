import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  RefreshCw, BarChart2, Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar,
} from 'recharts';
import useAuthStore from '../store/authStore';
import { dashboardApi } from '../api/client';

const fmt  = (n) => Number(n || 0).toFixed(2);
const fmtN = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

// ── Stat card ────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = 'primary', loading }) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    green:   'bg-green-50  text-green-600',
    orange:  'bg-orange-50 text-orange-600',
    red:     'bg-red-50    text-red-600',
  };
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        {loading
          ? <div className="h-7 w-20 bg-gray-100 animate-pulse rounded mt-1" />
          : <p className="text-2xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        }
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Low-stock badge ───────────────────────────────────────────
function LowStockPanel({ products, loading }) {
  if (loading) return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-500" /> Low Stock Alerts
      </h3>
      <div className="space-y-2">
        {[1,2,3].map((i) => (
          <div key={i} className="h-8 bg-gray-100 animate-pulse rounded" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <h3 className="font-semibold text-gray-700 text-sm">Low Stock Alerts</h3>
        <span className="ml-auto text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5">
          {products.length}
        </span>
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">All products well stocked ✓</p>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                {p.category && <p className="text-xs text-gray-400">{p.category}</p>}
              </div>
              <span className={`text-sm font-bold tabular-nums
                ${p.stock_quantity <= 0 ? 'text-red-600' : 'text-orange-500'}`}>
                {p.stock_quantity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Top products ──────────────────────────────────────────────
function TopProducts({ products, title, loading }) {
  if (loading) return (
    <div className="card p-5 space-y-3">
      <div className="h-5 w-32 bg-gray-100 animate-pulse rounded" />
      {[1,2,3,4,5].map((i) => (
        <div key={i} className="h-6 bg-gray-100 animate-pulse rounded" />
      ))}
    </div>
  );

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No sales yet</p>
      ) : (
        <ol className="divide-y divide-gray-100">
          {products.map((p, i) => (
            <li key={p.product_id || p.name}
                className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700
                               flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-gray-800 flex-1 truncate">{p.name}</span>
              <span className="text-xs text-gray-400 tabular-nums">
                ×{Math.round(p.qty_sold)}
              </span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {fmtN(p.revenue)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Custom tooltip for charts ─────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{Number(p.value).toFixed(2)}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Main DashboardPage ────────────────────────────────────────
const POLL_INTERVAL = 30_000; // 30 seconds

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const [todayData,    setTodayData]    = useState(null);
  const [weekData,     setWeekData]     = useState(null);
  const [lowStock,     setLowStock]     = useState([]);
  const [view,         setView]         = useState('week'); // 'today' | 'week'
  const [loadingToday, setLoadingToday] = useState(true);
  const [loadingWeek,  setLoadingWeek]  = useState(true);
  const [loadingStock, setLoadingStock] = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const timerRef = useRef();

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) { setLoadingToday(true); setLoadingWeek(true); setLoadingStock(true); }
    try {
      const [td, wk, ls] = await Promise.all([
        dashboardApi.today(),
        dashboardApi.week(),
        dashboardApi.lowStock(),
      ]);
      setTodayData(td.data);
      setWeekData(wk.data);
      setLowStock(ls.data.products);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard fetch error', err);
    } finally {
      setLoadingToday(false);
      setLoadingWeek(false);
      setLoadingStock(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(() => fetchAll(true), POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchAll]);

  // Format chart data for 7-day line chart
  const chartData = weekData?.daily?.map((d) => ({
    day:    new Date(d.day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
    Sales:  parseFloat(d.sales) || 0,
    Txns:   parseInt(d.transactions, 10) || 0,
  })) || [];

  // Hourly bar chart for today
  const hourlyData = todayData?.hourly?.map((h) => ({
    hour:  `${String(h.hour).padStart(2, '0')}:00`,
    Sales: parseFloat(h.sales) || 0,
  })) || [];

  const summary = todayData?.summary || {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {user?.shop_name}
            {lastRefresh && ` · Updated ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          className="btn-secondary text-xs"
          onClick={() => fetchAll()}
          disabled={loadingToday}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingToday ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Today stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Today's Revenue"
          value={fmtN(summary.total_sales)}
          sub={`Tax: ${fmt(summary.total_tax)}`}
          icon={TrendingUp}
          color="primary"
          loading={loadingToday}
        />
        <StatCard
          label="Transactions"
          value={summary.transaction_count || 0}
          sub={`Discounts: ${fmt(summary.total_discounts)}`}
          icon={ShoppingCart}
          color="green"
          loading={loadingToday}
        />
        <StatCard
          label="Items Sold"
          value={Math.round(todayData?.items_sold || 0)}
          sub="Units today"
          icon={Package}
          color="orange"
          loading={loadingToday}
        />
        <StatCard
          label="Low Stock"
          value={lowStock.length}
          sub={lowStock.length > 0 ? 'Need attention' : 'All good ✓'}
          icon={AlertTriangle}
          color={lowStock.length > 0 ? 'red' : 'green'}
          loading={loadingStock}
        />
      </div>

      {/* Payment method breakdown for today */}
      {!loadingToday && (Number(summary.cash_sales) > 0 || Number(summary.card_sales) > 0 || Number(summary.mobile_sales) > 0) && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Cash',   val: summary.cash_sales,   cls: 'bg-green-50  border-green-100 text-green-700' },
            { label: 'Card',   val: summary.card_sales,   cls: 'bg-blue-50   border-blue-100  text-blue-700'  },
            { label: 'Mobile', val: summary.mobile_sales, cls: 'bg-purple-50 border-purple-100 text-purple-700' },
          ].map(({ label, val, cls }) => (
            <div key={label} className={`rounded-xl border p-3 ${cls}`}>
              <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
              <p className="text-lg font-bold mt-0.5">{fmtN(val)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart section */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-gray-400" />
            Sales Trend
          </h2>
          <div className="flex gap-1">
            <button
              className={`text-xs px-3 py-1 rounded-lg border transition-colors
                ${view === 'week' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              onClick={() => setView('week')}
            >7 Days</button>
            <button
              className={`text-xs px-3 py-1 rounded-lg border transition-colors
                ${view === 'today' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              onClick={() => setView('today')}
            >Today (hourly)</button>
          </div>
        </div>

        {(loadingWeek || loadingToday) ? (
          <div className="h-56 flex items-center justify-center text-gray-300">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : view === 'week' ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={50} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Sales" stroke="#2563eb"
                    strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={50} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Sales" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopProducts
          products={todayData?.top_products || []}
          title="Top 5 Products Today"
          loading={loadingToday}
        />
        <TopProducts
          products={weekData?.top_products || []}
          title="Top 5 Products This Week"
          loading={loadingWeek}
        />
        <LowStockPanel products={lowStock} loading={loadingStock} />
      </div>
    </div>
  );
}
