import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, TrendingUp, ClipboardList, Clock, Loader2,
  AlertTriangle, Car, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { carwashApi } from '../../api/client';
import useAuthStore from '../../store/authStore';

const STATUS_BADGE = {
  waiting:     { label: 'Waiting',     cls: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100  text-blue-700'   },
  completed:   { label: 'Completed',   cls: 'bg-green-100 text-green-700'  },
  paid:        { label: 'Paid',        cls: 'bg-gray-100  text-gray-600'   },
};

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function CarWashDashboard() {
  const user    = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'staff';
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carwashApi.dashboard()
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const revenue = parseFloat(data?.today_revenue || 0).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</p>
        </div>
        <Link
          to="/carwash/jobs/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> New Job
        </Link>
      </div>

      {/* Low stock warning */}
      {data?.low_stock_count > 0 && (
        <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200
                        rounded-xl text-sm text-orange-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{data.low_stock_count}</strong> product{data.low_stock_count > 1 ? 's' : ''} running low on stock.{' '}
            <Link to="/carwash/products" className="underline font-medium">View products</Link>
          </span>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {!isStaff && (
          <StatCard icon={TrendingUp} label="Today's Revenue" value={`Rs. ${revenue}`} color="green" />
        )}
        <StatCard icon={ClipboardList} label="Jobs Today"    value={data?.today_jobs ?? 0}       color="blue"   />
        <StatCard icon={Clock}        label="Waiting"         value={data?.waiting_jobs ?? 0}     color="yellow" />
        <StatCard icon={Car}          label="In Progress"     value={data?.in_progress_jobs ?? 0} color="purple" />
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
          <Link to="/carwash/jobs" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {(!data?.recent_jobs || data.recent_jobs.length === 0) ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Car className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No jobs yet today</p>
            <Link to="/carwash/jobs/new" className="mt-2 inline-block text-blue-600 text-sm hover:underline">
              Create your first job
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {data.recent_jobs.map((job) => {
              const badge = STATUS_BADGE[job.status] || { label: job.status, cls: 'bg-gray-100 text-gray-600' };
              return (
                <Link
                  key={job.id}
                  to={`/carwash/jobs/${job.id}`}
                  className="flex items-center justify-between p-3 bg-white rounded-xl border
                             border-gray-100 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Car className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {job.vehicle_number || 'No plate'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {job.customer_name || job.phone_number || ''}
                        {job.staff_name && ` · ${job.staff_name}`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/carwash/bookings"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100
                     hover:border-blue-200 transition-colors"
        >
          <CheckCircle2 className="w-5 h-5 text-blue-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Bookings</p>
            <p className="text-xs text-gray-400">Manage schedule</p>
          </div>
        </Link>
        <Link
          to="/carwash/staff"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100
                     hover:border-blue-200 transition-colors"
        >
          <Car className="w-5 h-5 text-purple-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">My Jobs</p>
            <p className="text-xs text-gray-400">Assigned to me</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
