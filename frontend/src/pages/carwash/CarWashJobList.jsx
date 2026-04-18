import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Car, Search, Loader2, ChevronRight } from 'lucide-react';
import { carwashApi } from '../../api/client';
import useAuthStore from '../../store/authStore';

const STATUSES = [
  { value: '',            label: 'All'        },
  { value: 'waiting',     label: 'Waiting'    },
  { value: 'in_progress', label: 'In Progress'},
  { value: 'completed',   label: 'Completed'  },
  { value: 'paid',        label: 'Paid'       },
];

const STATUS_BADGE = {
  waiting:     { label: 'Waiting',     cls: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100  text-blue-700'   },
  completed:   { label: 'Completed',   cls: 'bg-green-100 text-green-700'  },
  paid:        { label: 'Paid',        cls: 'bg-gray-100  text-gray-600'   },
};

export default function CarWashJobList() {
  const user    = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'staff';
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [status,  setStatus]  = useState('');
  const [search,  setSearch]  = useState('');

  function fetchJobs() {
    setLoading(true);
    carwashApi.listJobs({ status: status || undefined, search: search || undefined })
      .then((r) => setJobs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchJobs(); }, [status]); // eslint-disable-line

  function handleSearch(e) {
    e.preventDefault();
    fetchJobs();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Jobs</h1>
        <Link
          to="/carwash/jobs/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> New Job
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Vehicle plate, phone, or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm
                     font-medium rounded-xl transition-colors"
        >
          Search
        </button>
      </form>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                        ${status === s.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Job list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Car className="w-10 h-10 mx-auto mb-2 opacity-25" />
          <p className="text-sm font-medium">No jobs found</p>
          <Link to="/carwash/jobs/new" className="mt-2 inline-block text-blue-600 text-sm hover:underline">
            Create a job
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const badge = STATUS_BADGE[job.status] || { label: job.status, cls: 'bg-gray-100 text-gray-600' };
            const total = parseFloat(job.total_amount || 0).toFixed(2);
            return (
              <Link
                key={job.id}
                to={`/carwash/jobs/${job.id}`}
                className="flex items-center justify-between p-4 bg-white rounded-xl border
                           border-gray-100 hover:border-blue-200 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                    <Car className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">
                        {job.vehicle_number || 'No plate'}
                      </p>
                      {job.vehicle_type && (
                        <span className="text-xs text-gray-400">· {job.vehicle_type}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {job.customer_name || job.phone_number || 'Unknown customer'}
                      {job.staff_name && ` · ${job.staff_name}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {job.created_at
                        ? new Date(job.created_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <div className="text-right">
                    <span className={`block text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {!isStaff && parseFloat(total) > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">Rs. {total}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
