import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Minus, Loader2, Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { carwashApi, authApi } from '../../api/client';

const VEHICLE_TYPES = ['Car', 'SUV', 'Van', 'Truck', 'Pickup', 'Motorbike', 'Other'];

export default function CarWashJobCreate() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    vehicle_number: '',
    vehicle_type: 'Car',
    customer_name: '',
    phone_number: '',
    assigned_staff_id: '',
    notes: '',
  });

  const [services,       setServices]       = useState([]);
  const [products,       setProducts]       = useState([]);
  const [staff,          setStaff]          = useState([]);
  const [selectedSvcs,   setSelectedSvcs]   = useState({}); // { id: true }
  const [selectedProds,  setSelectedProds]  = useState({}); // { id: qty }
  const [submitting,     setSubmitting]      = useState(false);

  useEffect(() => {
    Promise.all([
      carwashApi.listServices(),
      carwashApi.listProducts(),
      authApi.listUsers(),
    ]).then(([s, p, u]) => {
      setServices(s.data);
      setProducts(p.data);
      setStaff(u.data);
    }).catch(() => {});
  }, []);

  function toggleService(svc) {
    setSelectedSvcs((prev) => ({ ...prev, [svc.id]: !prev[svc.id] }));
  }

  function setProductQty(prod, delta) {
    setSelectedProds((prev) => {
      const cur = prev[prod.id] || 0;
      const next = Math.max(0, cur + delta);
      if (next === 0) {
        const { [prod.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [prod.id]: next };
    });
  }

  const serviceTotal = services
    .filter((s) => selectedSvcs[s.id])
    .reduce((sum, s) => sum + parseFloat(s.price), 0);

  const productTotal = products
    .filter((p) => selectedProds[p.id])
    .reduce((sum, p) => sum + parseFloat(p.price) * (selectedProds[p.id] || 0), 0);

  const grandTotal = serviceTotal + productTotal;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    const items = [
      ...services
        .filter((s) => selectedSvcs[s.id])
        .map((s) => ({ item_type: 'service', item_id: s.id, item_name: s.name, quantity: 1, unit_price: parseFloat(s.price) })),
      ...products
        .filter((p) => selectedProds[p.id])
        .map((p) => ({ item_type: 'product', item_id: p.id, item_name: p.name, quantity: selectedProds[p.id], unit_price: parseFloat(p.price) })),
    ];

    try {
      const { data } = await carwashApi.createJob({
        ...form,
        assigned_staff_id: form.assigned_staff_id || null,
        items,
      });
      toast.success('Job created!');
      navigate(`/carwash/jobs/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Job</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Vehicle info */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Car className="w-4 h-4" /> Vehicle Details
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Plate Number</label>
              <input
                type="text"
                placeholder="ABC-1234"
                value={form.vehicle_number}
                onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vehicle Type</label>
              <select
                value={form.vehicle_type}
                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="+1 234 567 8900"
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
          <h2 className="font-semibold text-gray-700 text-sm">Services</h2>
          {services.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No services configured yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => toggleService(svc)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border
                              text-sm transition-colors text-left
                              ${selectedSvcs[svc.id]
                                ? 'border-blue-400 bg-blue-50 text-blue-700'
                                : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                >
                  <span className="font-medium">{svc.name}</span>
                  <div className="flex items-center gap-2">
                    {svc.duration_minutes && (
                      <span className="text-xs text-gray-400">{svc.duration_minutes}min</span>
                    )}
                    <span className="font-semibold">Rs. {parseFloat(svc.price).toFixed(2)}</span>
                    {selectedSvcs[svc.id] && (
                      <span className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-[9px] font-bold">✓</span>
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Products / Add-ons */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
          <h2 className="font-semibold text-gray-700 text-sm">Products / Add-ons</h2>
          {products.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No products configured yet.</p>
          ) : (
            <div className="space-y-2">
              {products.map((prod) => {
                const qty = selectedProds[prod.id] || 0;
                const outOfStock = prod.stock_quantity === 0;
                return (
                  <div
                    key={prod.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border
                                ${qty > 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}
                                ${outOfStock ? 'opacity-50' : ''}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{prod.name}</p>
                      <p className="text-xs text-gray-400">
                        Rs. {parseFloat(prod.price).toFixed(2)}/{prod.unit}
                        {' · '}{prod.stock_quantity} in stock
                      </p>
                    </div>
                    {outOfStock ? (
                      <span className="text-xs text-red-500 font-medium">Out of stock</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={qty === 0}
                          onClick={() => setProductQty(prod, -1)}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center
                                     justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold text-gray-900">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setProductQty(prod, 1)}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center
                                     justify-center text-gray-600 hover:bg-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Assign staff & notes */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assign Staff</label>
            <select
              value={form.assigned_staff_id}
              onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">- Unassigned -</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Any special instructions…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Total + Submit */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-gray-700">Estimated Total</span>
            <span className="text-xl font-bold text-gray-900">Rs. {grandTotal.toFixed(2)}</span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                       text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Job
          </button>
        </div>
      </form>
    </div>
  );
}
