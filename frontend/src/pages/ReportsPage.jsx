import { useState } from 'react';
import {
  Download, FileSpreadsheet, FileText, Calendar,
  TrendingUp, Package, Loader2, CheckCircle2,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { reportsApi, transactionsApi } from '../api/client';

// ── Date helpers ──────────────────────────────────────────────
function today()     { return new Date().toISOString().split('T')[0]; }
function daysAgo(n)  { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }
function monthStart(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }

const PRESETS = [
  { label: 'Today',      start: today,      end: today      },
  { label: 'Yesterday',  start: () => daysAgo(1), end: () => daysAgo(1) },
  { label: 'Last 7 days', start: () => daysAgo(6), end: today },
  { label: 'This month', start: monthStart,  end: today      },
  { label: 'Last 30 days', start: () => daysAgo(29), end: today },
];

// Trigger a file download from a Blob
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const user    = useAuthStore((s) => s.user);
  const canExport = ['owner', 'manager'].includes(user?.role);

  const [startDate, setStartDate] = useState(today());
  const [endDate,   setEndDate]   = useState(today());
  const [loading,   setLoading]   = useState(''); // 'excel' | 'pdf' | 'inventory' | ''
  const [summary,   setSummary]   = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  function applyPreset(preset) {
    setStartDate(preset.start());
    setEndDate(preset.end());
    setSummary(null);
  }

  async function fetchSummary() {
    setLoadingSummary(true);
    try {
      const { data } = await transactionsApi.summary({ start_date: startDate, end_date: endDate });
      setSummary(data);
    } catch {
      // ignore
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleExport(format) {
    if (!canExport) return;
    setLoading(format);
    try {
      const blob = await reportsApi.sales(startDate, endDate, format);
      const ext  = format === 'pdf' ? 'pdf' : 'xlsx';
      downloadBlob(blob, `sales_${startDate}_to_${endDate}.${ext}`);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setLoading('');
    }
  }

  async function handleInventoryExport() {
    if (!canExport) return;
    setLoading('inventory');
    try {
      const blob = await reportsApi.inventory();
      downloadBlob(blob, `inventory_${today()}.xlsx`);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setLoading('');
    }
  }

  const fmt  = (n) => Number(n || 0).toFixed(2);
  const fmtN = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900">Reports & Export</h1>

      {!canExport && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg
                        px-4 py-2 text-sm">
          Export is available to owners and managers only.
        </div>
      )}

      {/* ── Sales Report ──────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-800">Sales Report</h2>
        </div>

        {/* Preset buttons */}
        <div>
          <p className="label">Quick range</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="btn-secondary text-xs py-1 px-3"
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> From
            </label>
            <input
              type="date"
              className="input"
              value={startDate}
              max={endDate}
              onChange={(e) => { setStartDate(e.target.value); setSummary(null); }}
            />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> To
            </label>
            <input
              type="date"
              className="input"
              value={endDate}
              min={startDate}
              max={today()}
              onChange={(e) => { setEndDate(e.target.value); setSummary(null); }}
            />
          </div>
        </div>

        {/* Preview summary */}
        <div>
          <button
            className="btn-secondary text-sm"
            onClick={fetchSummary}
            disabled={loadingSummary}
          >
            {loadingSummary
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>
              : 'Preview Summary'
            }
          </button>

          {summary && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Transactions',  val: summary.total_transactions },
                { label: 'Revenue',       val: fmtN(summary.total_revenue) },
                { label: 'Tax',           val: fmt(summary.total_tax) },
                { label: 'Discounts',     val: fmt(summary.total_discounts) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 uppercase">{label}</p>
                  <p className="text-lg font-bold text-gray-900 mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <button
            className="btn-primary"
            onClick={() => handleExport('excel')}
            disabled={!canExport || !!loading}
          >
            {loading === 'excel'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><FileSpreadsheet className="w-4 h-4" /> Download Excel</>
            }
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleExport('pdf')}
            disabled={!canExport || !!loading}
          >
            {loading === 'pdf'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><FileText className="w-4 h-4" /> Download PDF</>
            }
          </button>
        </div>

        {/* What's included */}
        <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
          <p className="font-medium">Excel export includes 3 sheets:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Summary — totals, counts, tax, discounts</li>
            <li>Transactions — one row per sale with all columns</li>
            <li>Line Items — one row per product sold</li>
          </ul>
          <p className="font-medium mt-1.5">PDF export includes:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Summary header + table of all transactions</li>
          </ul>
        </div>
      </div>

      {/* ── Inventory Report ──────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-orange-500" />
          <h2 className="font-semibold text-gray-800">Inventory Report</h2>
        </div>

        <p className="text-sm text-gray-500">
          Downloads current stock levels for all products.
          Low-stock rows (qty &lt; 10) are highlighted in red.
        </p>

        <button
          className="btn-primary"
          onClick={handleInventoryExport}
          disabled={!canExport || !!loading}
        >
          {loading === 'inventory'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            : <><Download className="w-4 h-4" /> Download Inventory Excel</>
          }
        </button>
      </div>
    </div>
  );
}
