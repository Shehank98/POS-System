import { useEffect, useState } from 'react';
import { CalendarDays, Plus, ChevronRight, Loader2, CheckCircle2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { carwashApi, authApi } from '../../api/client';

const STATUS_BADGE = {
  booked:           { label: 'Booked',      cls: 'bg-blue-100  text-blue-700'   },
  arrived:          { label: 'Arrived',     cls: 'bg-yellow-100 text-yellow-700' },
  converted_to_job: { label: 'Converted',   cls: 'bg-green-100 text-green-700'  },
  cancelled:        { label: 'Cancelled',   cls: 'bg-gray-100  text-gray-400'   },
};

function BookingForm({ initial, services, staff, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    vehicle_number: '', phone_number: '', customer_name: '',
    service_id: '', booking_date: '', time_slot: '',
    assigned_staff_id: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const TIME_SLOTS = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00',
  ];

  async function handleSave(e) {
    e.preventDefault();
    if (!form.booking_date || !form.time_slot) {
      toast.error('Date and time slot are required');
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{initial?.id ? 'Edit Booking' : 'New Booking'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date *</label>
              <input type="date" required value={form.booking_date}
                onChange={(e) => setForm({ ...form, booking_date: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Time Slot *</label>
              <select required value={form.time_slot}
                onChange={(e) => setForm({ ...form, time_slot: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Pick time —</option>
                {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {[
            { key: 'vehicle_number', label: 'Plate Number', placeholder: 'ABC-1234' },
            { key: 'customer_name',  label: 'Customer Name', placeholder: 'John Doe' },
            { key: 'phone_number',   label: 'Phone', placeholder: '+1 234 567 8900' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input type="text" placeholder={placeholder}
                value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Service</label>
            <select value={form.service_id}
              onChange={(e) => setForm({ ...form, service_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Any service —</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} — ${parseFloat(s.price).toFixed(2)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assign Staff</label>
            <select value={form.assigned_staff_id}
              onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Unassigned —</option>
              {staff.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea rows={2} placeholder="Special instructions…"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CarWashBookings() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [bookings,  setBookings]  = useState([]);
  const [services,  setServices]  = useState([]);
  const [staff,     setStaff]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [date,      setDate]      = useState(today);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);

  function loadBookings(d) {
    return carwashApi.listBookings({ date: d })
      .then((r) => setBookings(r.data))
      .catch(() => {});
  }

  useEffect(() => {
    Promise.all([
      loadBookings(date),
      carwashApi.listServices(),
      authApi.listUsers(),
    ]).then(([, s, u]) => {
      setServices(s.data);
      setStaff(u.data);
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => { loadBookings(date); }, [date]); // eslint-disable-line

  async function handleSave(form) {
    try {
      if (editing?.id) {
        await carwashApi.updateBooking(editing.id, form);
        toast.success('Booking updated');
      } else {
        await carwashApi.createBooking(form);
        toast.success('Booking created');
      }
      setShowForm(false);
      setEditing(null);
      await loadBookings(date);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save booking');
    }
  }

  async function handleConvert(booking) {
    try {
      const { data } = await carwashApi.convertBooking(booking.id);
      toast.success('Booking converted to job!');
      navigate(`/carwash/jobs/${data.job.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to convert booking');
    }
  }

  async function handleCancel(id) {
    try {
      await carwashApi.updateBookingStatus(id, 'cancelled');
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'cancelled' } : b));
      toast.success('Booking cancelled');
    } catch (err) {
      toast.error('Failed to cancel booking');
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Bookings</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> New Booking
        </button>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-gray-400" />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setDate(today)}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-600 rounded-lg transition-colors"
        >
          Today
        </button>
      </div>

      {/* Booking list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 text-gray-400">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No bookings on this date</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const badge = STATUS_BADGE[b.status] || { label: b.status, cls: 'bg-gray-100 text-gray-500' };
            return (
              <div key={b.id}
                className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{b.time_slot}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">
                      {b.customer_name || b.phone_number || 'Unknown'}
                      {b.vehicle_number && ` · ${b.vehicle_number}`}
                    </p>
                    {b.service_name && (
                      <p className="text-xs text-gray-400">{b.service_name}</p>
                    )}
                    {b.staff_name && (
                      <p className="text-xs text-gray-400">Staff: {b.staff_name}</p>
                    )}
                  </div>
                </div>

                {b.status === 'booked' || b.status === 'arrived' ? (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleConvert(b)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600
                                 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Convert to Job
                    </button>
                    <button
                      onClick={() => { setEditing(b); setShowForm(true); }}
                      className="px-3 py-2 border border-gray-200 text-gray-600 text-xs
                                 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleCancel(b.id)}
                      className="px-3 py-2 border border-red-100 text-red-500 text-xs
                                 font-medium rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <BookingForm
          initial={editing}
          services={services}
          staff={staff}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
