import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Car, Search, CalendarDays, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { carwashPublicApi } from '../api/client';

const STATUS_INFO = {
  waiting:     { label: 'Waiting',     color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock       },
  in_progress: { label: 'In Progress', color: 'text-blue-600',   bg: 'bg-blue-50',   icon: Car         },
  completed:   { label: 'Completed',   color: 'text-green-600',  bg: 'bg-green-50',  icon: CheckCircle2 },
  paid:        { label: 'Paid',        color: 'text-gray-600',   bg: 'bg-gray-50',   icon: CheckCircle2 },
};

function BookingForm({ shopId, services, onBooked }) {
  const [form, setForm] = useState({
    vehicle_number: '', phone_number: '', customer_name: '',
    service_id: '', booking_date: '', time_slot: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const TIME_SLOTS = [
    '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
    '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
    '16:00','16:30','17:00','17:30','18:00',
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.booking_date || !form.time_slot) {
      toast.error('Date and time slot are required');
      return;
    }
    setSubmitting(true);
    try {
      await carwashPublicApi.createBooking({ ...form, shop_id: shopId });
      toast.success('Booking confirmed!');
      onBooked();
      setForm({ vehicle_number: '', phone_number: '', customer_name: '', service_id: '', booking_date: '', time_slot: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date *</label>
          <input type="date" required
            min={new Date().toISOString().slice(0, 10)}
            value={form.booking_date}
            onChange={(e) => setForm({ ...form, booking_date: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Time *</label>
          <select required value={form.time_slot}
            onChange={(e) => setForm({ ...form, time_slot: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select a time</option>
            {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      {[
        { key: 'vehicle_number', label: 'Plate Number', placeholder: 'ABC-1234', type: 'text' },
        { key: 'customer_name',  label: 'Your Name',    placeholder: 'John Doe',  type: 'text' },
        { key: 'phone_number',   label: 'Phone Number', placeholder: '+1 234 567 8900', type: 'tel' },
      ].map(({ key, label, placeholder, type }) => (
        <div key={key}>
          <label className="block text-xs text-gray-500 mb-1">{label}</label>
          <input type={type} placeholder={placeholder}
            value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      ))}
      {services.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Service</label>
          <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select a service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} (Rs. {parseFloat(s.price).toFixed(2)})</option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" disabled={submitting}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white
                   font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Confirm Booking
      </button>
    </form>
  );
}

export default function CarWashPortal() {
  const [params] = useSearchParams();
  const shopId = params.get('shop_id');

  const [shopInfo,  setShopInfo]  = useState(null);
  const [services,  setServices]  = useState([]);
  const [phone,     setPhone]     = useState('');
  const [vehicle,   setVehicle]   = useState('');
  const [results,   setResults]   = useState(null);
  const [searching, setSearching] = useState(false);
  const [tab,       setTab]       = useState('lookup'); // 'lookup' | 'booking'

  useEffect(() => {
    if (!shopId) return;
    carwashPublicApi.shopInfo(shopId)
      .then((r) => {
        setShopInfo(r.data.shop);
        setServices(r.data.services);
      })
      .catch(() => {});
  }, [shopId]);

  async function handleLookup(e) {
    e.preventDefault();
    if (!phone && !vehicle) { toast.error('Enter phone or plate number'); return; }
    setSearching(true);
    try {
      const { data } = await carwashPublicApi.lookup(shopId, phone || undefined, vehicle || undefined);
      setResults(data);
    } catch {
      toast.error('Lookup failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  if (!shopId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center text-gray-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="font-medium">Invalid portal link</p>
          <p className="text-sm mt-1">Please scan the QR code again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">{shopInfo?.name || 'Car Service'}</p>
            <p className="text-xs text-gray-400">Customer Portal</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Tab switch */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          {[
            { id: 'lookup',  label: 'Track My Car'   },
            { id: 'booking', label: 'Book a Service'  },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors
                          ${tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Track tab */}
        {tab === 'lookup' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <p className="text-sm text-gray-600">Enter your phone number or vehicle plate to check your car's status.</p>
              <form onSubmit={handleLookup} className="space-y-2">
                <input type="tel" placeholder="Phone number (e.g. +1234567890)"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-center text-xs text-gray-400">or</p>
                <input type="text" placeholder="Plate number (e.g. ABC-1234)"
                  value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit" disabled={searching}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white
                             font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </form>
            </div>

            {results && (
              <div className="space-y-3">
                {/* Active / recent jobs */}
                {results.jobs && results.jobs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Jobs</p>
                    {results.jobs.map((job) => {
                      const info = STATUS_INFO[job.status] || STATUS_INFO.waiting;
                      const Icon = info.icon;
                      return (
                        <div key={job.id} className={`rounded-xl border p-4 ${info.bg} border-transparent`}>
                          <div className="flex items-center gap-3">
                            <Icon className={`w-5 h-5 ${info.color} shrink-0`} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-gray-900 text-sm">
                                  {job.vehicle_number || 'Your vehicle'}
                                </p>
                                <span className={`text-xs font-semibold ${info.color}`}>{info.label}</span>
                              </div>
                              {job.vehicle_type && (
                                <p className="text-xs text-gray-500">{job.vehicle_type}</p>
                              )}
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(job.created_at).toLocaleString('en-US', {
                                  month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                                {parseFloat(job.total_amount) > 0 && ` · Rs. ${parseFloat(job.total_amount).toFixed(2)}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Bookings */}
                {results.bookings && results.bookings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Upcoming Bookings</p>
                    {results.bookings.map((b) => (
                      <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                        <CalendarDays className="w-5 h-5 text-blue-500 shrink-0" />
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {new Date(b.booking_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            {' at '}{b.time_slot}
                          </p>
                          {b.service_name && (
                            <p className="text-xs text-gray-400">{b.service_name}</p>
                          )}
                          <p className="text-xs text-blue-600 font-medium capitalize">{b.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {results.jobs?.length === 0 && results.bookings?.length === 0 && (
                  <div className="text-center py-8 bg-white rounded-xl border border-gray-100 text-gray-400">
                    <Car className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No records found</p>
                    <p className="text-xs mt-1">Try a different phone number or plate</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Booking tab */}
        {tab === 'booking' && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Book a Service</h2>
            <BookingForm
              shopId={shopId}
              services={services}
              onBooked={() => setTab('lookup')}
            />
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by Car Service POS
        </p>
      </div>
    </div>
  );
}
