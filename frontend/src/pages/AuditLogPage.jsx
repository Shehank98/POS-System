import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import { auditApi } from '../api/client';

const TYPE_LABELS = {
  product:          { label: 'Product Deleted',     cls: 'bg-red-100    text-red-700'    },
  transaction_void: { label: 'Transaction Voided',  cls: 'bg-orange-100 text-orange-700' },
};

function typeInfo(t) {
  return TYPE_LABELS[t] || { label: t, cls: 'bg-gray-100 text-gray-600' };
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';
}

function JsonBlock({ data }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {open ? 'Hide' : 'Show'} original data
      </button>
      {open && (
        <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded-lg p-3
                        overflow-x-auto whitespace-pre-wrap break-words text-gray-600 max-h-60">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

const RECORD_TYPES = [
  { value: '',                 label: 'All types'          },
  { value: 'product',          label: 'Product deletions'  },
  { value: 'transaction_void', label: 'Transaction voids'  },
];

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const [records,  setRecords]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [filter,   setFilter]   = useState('');
  const [page,     setPage]     = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (filter) params.record_type = filter;
      const { data } = await auditApi.list(params);
      setRecords(data.records);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  function handleFilterChange(val) {
    setFilter(val);
    setPage(0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-gray-500" />
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          {total > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {total} record{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Shows deleted products and voided transactions for this shop.
      </p>

      {/* Filter */}
      <div className="flex gap-2">
        {RECORD_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => handleFilterChange(t.value)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors
              ${filter === t.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading && records.length === 0 && (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No deleted records found</p>
          </div>
        )}

        {records.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">Record ID</th>
                  <th className="text-left px-4 py-2.5">Deleted By</th>
                  <th className="text-left px-4 py-2.5">Date &amp; Time</th>
                  <th className="text-left px-4 py-2.5">Original Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => {
                  const info = typeInfo(r.record_type);
                  // Show a friendly name from original_data if available
                  const preview = r.original_data?.name
                    || r.original_data?.transaction_number
                    || `#${r.record_id}`;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${info.cls}`}>
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{preview}</td>
                      <td className="px-4 py-3 text-gray-500">{r.deleted_by || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(r.deleted_at)}</td>
                      <td className="px-4 py-3">
                        <JsonBlock data={r.original_data} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {page + 1} of {totalPages} · {total} records
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
