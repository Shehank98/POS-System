import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, CalendarDays, Loader2, ChevronRight, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { carwashApi } from '../../api/client';
import useAuthStore from '../../store/authStore';

const STATUS_BADGE = {
  waiting:     { label: 'Waiting',     cls: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100  text-blue-700'   },
  completed:   { label: 'Completed',   cls: 'bg-green-100 text-green-700'  },
};

export default function CarWashStaffView() {
  const user = useAuthStore((s) => s.user);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    return carwashApi.staffView()
      .then((r) => setData(r.data))
      .catch(() => {});
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function handleStart(jobId) {
    try {
      await carwashApi.updateJobStatus(jobId, 'in_progress');
      await load();
      toast.success('Job started!');
    } catch {
      toast.error('Failed to update job');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const myJobs       = data?.my_jobs || [];
  const upcomingBkgs = data?.upcoming_bookings || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Jobs</h1>
        <p className="text-sm text-gray-500">
          {user?.username} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Today's jobs */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-3 text-sm">Today's Jobs</h2>
        {myJobs.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-100 text-gray-400">
            <Car className="w-7 h-7 mx-auto mb-1 opacity-30" />
            <p className="text-sm">No jobs assigned to you today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myJobs.map((job) => {
              const badge = STATUS_BADGE[job.status] || { label: job.status, cls: 'bg-gray-100 text-gray-600' };
              const total = parseFloat(job.total_amount || 0).toFixed(2);
              return (
                <div key={job.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm">
                          {job.vehicle_number || 'No plate'}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {job.customer_name || job.phone_number || 'Unknown'}
                        {job.vehicle_type && ` · ${job.vehicle_type}`}
                        {parseFloat(total) > 0 && ` · $${total}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {job.status === 'waiting' && (
                      <button
                        onClick={() => handleStart(job.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700
                                   text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <PlayCircle className="w-3.5 h-3.5" /> Start
                      </button>
                    )}
                    <Link
                      to={`/carwash/jobs/${job.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-200
                                 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      View <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming bookings */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-3 text-sm">Upcoming Bookings</h2>
        {upcomingBkgs.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-100 text-gray-400">
            <CalendarDays className="w-7 h-7 mx-auto mb-1 opacity-30" />
            <p className="text-sm">No upcoming bookings</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingBkgs.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {b.booking_date ? new Date(b.booking_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    {' at '}{b.time_slot}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {b.customer_name || b.vehicle_number || 'Unknown'}
                    {b.service_name && ` · ${b.service_name}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
