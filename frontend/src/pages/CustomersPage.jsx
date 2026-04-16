import { useState, useCallback } from 'react';
import { Search, Users, ShoppingBag, TrendingUp, Clock, AlertTriangle, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { customersApi } from '../api/client';

const fmt = (n) => Number(n || 0).toFixed(2);

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary-600', bg = 'bg-primary-50' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function CustomerInsightsCard({ data }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={ShoppingBag} label="Total Orders" value={data.total_orders} />
        <StatCard icon={TrendingUp}  label="Total Spent"  value={`Rs. ${fmt(data.total_spent)}`} bg="bg-green-50" color="text-green-600" />
        <StatCard icon={Clock}       label="Last Order"   value={data.last_order_date ? new Date(data.last_order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'} bg="bg-blue-50" color="text-blue-600" />
        <StatCard
          icon={AlertTriangle}
          label="Cancellations"
          value={data.cancellation_tracking?.total_cancellations ?? 0}
          sub={data.cancellation_tracking?.cooldown_active ? 'Cooldown active' : undefined}
          bg={data.cancellation_tracking?.total_cancellations > 0 ? 'bg-orange-50' : 'bg-gray-50'}
          color={data.cancellation_tracking?.total_cancellations > 0 ? 'text-orange-600' : 'text-gray-400'}
        />
      </div>

      {/* Top items */}
      {data.top_items?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-semibold text-gray-700">Frequently Ordered</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {data.top_items.map((item, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-800">{item.item_name}</span>
                <span className="text-gray-500 text-xs">× {Number(item.total_qty).toFixed(0)} ({item.order_count} orders)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent orders */}
      {data.recent_orders?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Recent Orders</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {data.recent_orders.map((o, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-2">{o.token_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      o.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-700'}`}>
                    {o.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-800">Rs. {fmt(o.total_amount)}</p>
                  <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CustomersPage() {
  const [phone,      setPhone]      = useState('');
  const [insights,   setInsights]   = useState(null);
  const [searching,  setSearching]  = useState(false);
  const [topCusts,   setTopCusts]   = useState(null);
  const [loadingTop, setLoadingTop] = useState(false);
  const [topLoaded,  setTopLoaded]  = useState(false);

  const handleSearch = useCallback(async () => {
    const p = phone.trim();
    if (!p) { toast.error('Enter a phone number'); return; }
    setSearching(true);
    setInsights(null);
    try {
      const { data } = await customersApi.getInsights(p);
      setInsights(data);
      if (!data.total_orders) toast('No orders found for this number.', { icon: 'ℹ️' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [phone]);

  async function loadTopCustomers() {
    setLoadingTop(true);
    try {
      const { data } = await customersApi.getTop(20);
      setTopCusts(data.customers);
      setTopLoaded(true);
    } catch {
      toast.error('Failed to load top customers');
    } finally {
      setLoadingTop(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-500 mt-0.5">Look up customer history and insights by phone number.</p>
      </div>

      {/* Phone search */}
      <div className="card p-4">
        <label className="label mb-1">Search by Phone Number</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="e.g. 0712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            className="btn-primary px-5 disabled:opacity-60"
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Insights result */}
      {insights && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-700">{insights.customer_phone}</p>
            {insights.customer_name && (
              <span className="text-sm text-gray-400">— {insights.customer_name}</span>
            )}
          </div>
          <CustomerInsightsCard data={insights} />
        </div>
      )}

      {/* Top customers section */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary-600" />
            <p className="text-sm font-semibold text-gray-700">Top Customers</p>
          </div>
          {!topLoaded && (
            <button
              className="text-xs text-primary-600 font-medium hover:underline disabled:opacity-50"
              onClick={loadTopCustomers}
              disabled={loadingTop}
            >
              {loadingTop ? 'Loading…' : 'Load'}
            </button>
          )}
        </div>

        {topLoaded && topCusts && (
          <div className="overflow-x-auto">
            {topCusts.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-6 text-center">No customer data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">#</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Phone</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-right">Orders</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-right">Total Spent</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-right">Last Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topCusts.map((c, i) => (
                    <tr
                      key={c.customer_phone}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => { setPhone(c.customer_phone); }}
                    >
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{c.customer_phone}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{c.total_orders}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-800">Rs. {fmt(c.total_spent)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 text-xs">
                        {new Date(c.last_order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!topLoaded && (
          <p className="text-xs text-gray-400 px-4 py-4 text-center">
            Click "Load" to view top customers by total spend.
          </p>
        )}
      </div>
    </div>
  );
}
