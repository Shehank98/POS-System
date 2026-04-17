import { useState, useEffect } from 'react';
import { RefreshCw, Download, TrendingUp, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { clothingApi } from '../api/client';

const fmt = (n) => Number(n || 0).toFixed(2);

const PIE_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981',
  '#3b82f6','#ef4444','#14b8a6','#f97316','#84cc16',
];

function DateRange({ start, end, onStart, onEnd }) {
  return (
    <div className="flex items-center gap-2">
      <input type="date" className="input py-1.5 text-sm h-9" value={start} onChange={(e) => onStart(e.target.value)} />
      <span className="text-gray-400 text-sm">–</span>
      <input type="date" className="input py-1.5 text-sm h-9" value={end} onChange={(e) => onEnd(e.target.value)} />
    </div>
  );
}

function SizeChart({ data }) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-8">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="size" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip
          formatter={(v) => [v, 'Units sold']}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="total_qty" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ColorChart({ data }) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-8">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total_qty"
          nameKey="color"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ color, percent }) => `${color} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => [v, 'Units']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function LowStockTable({ data, onAdjust }) {
  if (!data.length) return (
    <p className="text-sm text-gray-400 text-center py-6">No low-stock variants.</p>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
            <th className="pb-2 text-left">Product</th>
            <th className="pb-2 text-left">Size / Color</th>
            <th className="pb-2 text-right">Stock</th>
            <th className="pb-2 text-right">Threshold</th>
            <th className="pb-2 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((v) => (
            <tr key={v.id} className="hover:bg-gray-50">
              <td className="py-2.5 pr-3 font-medium text-gray-800 truncate max-w-[120px]">
                {v.product_name}
              </td>
              <td className="py-2.5 pr-3 text-gray-500">{v.size} / {v.color}</td>
              <td className="py-2.5 pr-3 text-right">
                <span className={`font-semibold ${v.stock_quantity <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {v.stock_quantity}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-right text-gray-400">{v.low_stock_threshold}</td>
              <td className="py-2.5 text-right">
                <button
                  onClick={() => onAdjust(v)}
                  className="text-xs text-primary-600 hover:underline font-medium"
                >
                  Adjust
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdjustModal({ variant, onClose, onDone }) {
  const [delta, setDelta] = useState('');
  const [note,  setNote]  = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const d = parseInt(delta, 10);
    if (!d) { toast.error('Enter a non-zero amount'); return; }
    setSaving(true);
    try {
      await clothingApi.adjustStock(variant.id, { delta: d, reason: 'correction', note });
      toast.success('Stock updated');
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to adjust');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
           onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900">Adjust Stock</h3>
        <p className="text-sm text-gray-500">
          {variant.product_name} · {variant.size} / {variant.color}
          <br />Current stock: <strong>{variant.stock_quantity}</strong>
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Delta (+ add / - remove)</label>
            <input
              autoFocus type="number"
              className="input w-full text-sm"
              placeholder="e.g. +10 or -2"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Note (optional)</label>
            <input
              className="input w-full text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-1.5">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5">
              {saving ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ClothingAnalyticsPage() {
  const [start,    setStart]    = useState(daysAgo(29));
  const [end,      setEnd]      = useState(today());
  const [sizes,    setSizes]    = useState([]);
  const [colors,   setColors]   = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [adjVariant, setAdjVariant] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = { start, end };
      const [s, c, l] = await Promise.allSettled([
        clothingApi.bestSizes(params),
        clothingApi.bestColors(params),
        clothingApi.getLowStock(),
      ]);
      if (s.status === 'fulfilled') setSizes(s.value.data.sizes   || []);
      if (c.status === 'fulfilled') setColors(c.value.data.colors || []);
      if (l.status === 'fulfilled') setLowStock(l.value.data.variants || []);
      const failed = [s, c, l].filter((r) => r.status === 'rejected');
      if (failed.length === 3) toast.error('Failed to load analytics');
      else if (failed.length > 0) toast.error('Some analytics data could not be loaded');
    } catch {
      toast.error('Failed to load analytics');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function exportExcel() {
    try {
      const params = { start, end, format: 'xlsx' };
      const res = await clothingApi.dailySales(params);
      // Fall back: if API returns JSON, just show toast
      if (res.headers?.['content-type']?.includes('json')) {
        toast('Excel export not yet enabled on the server.');
        return;
      }
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `clothing-sales-${start}-${end}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          Clothing Analytics
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
          <button onClick={load} disabled={loading} className="btn-secondary h-9 px-3 text-sm">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Apply'}
          </button>
          <button onClick={exportExcel} className="btn-secondary h-9 px-3 text-sm flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Best-selling sizes */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Best-Selling Sizes</h2>
          <SizeChart data={sizes} />
        </div>

        {/* Best-selling colors */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Best-Selling Colors</h2>
          <ColorChart data={colors} />
        </div>
      </div>

      {/* Low stock */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-700">Low / Out-of-Stock Variants</h2>
          <span className="ml-auto text-xs text-gray-400">{lowStock.length} items</span>
        </div>
        <LowStockTable data={lowStock} onAdjust={setAdjVariant} />
      </div>

      {adjVariant && (
        <AdjustModal
          variant={adjVariant}
          onClose={() => setAdjVariant(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
