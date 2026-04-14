import { useEffect, useState } from 'react';
import { Plus, Pencil, X, Loader2, Wrench, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { carwashApi } from '../../api/client';

function ServiceForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial || { name: '', price: '', duration_minutes: '' }
  );
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{initial?.id ? 'Edit Service' : 'New Service'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Service Name *</label>
            <input type="text" required placeholder="e.g. Full Wash"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Price ($)</label>
              <input type="number" step="0.01" min="0" placeholder="0.00"
                value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
              <input type="number" min="0" placeholder="30"
                value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CarWashServices() {
  const [services, setServices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    return carwashApi.listServices({ include_inactive: 'true' })
      .then((r) => setServices(r.data))
      .catch(() => {});
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function handleSave(form) {
    try {
      if (editing?.id) {
        await carwashApi.updateService(editing.id, form);
        toast.success('Service updated');
      } else {
        await carwashApi.createService(form);
        toast.success('Service created');
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save service');
    }
  }

  async function toggleActive(svc) {
    try {
      await carwashApi.updateService(svc.id, { is_active: !svc.is_active });
      setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, is_active: !s.is_active } : s));
    } catch {
      toast.error('Failed to update service');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Services</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 text-gray-400">
          <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No services yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((svc) => (
            <div key={svc.id}
              className={`flex items-center justify-between p-4 bg-white rounded-xl border
                          transition-colors ${svc.is_active ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{svc.name}</p>
                <p className="text-xs text-gray-400">
                  Rs. {parseFloat(svc.price).toFixed(2)}
                  {svc.duration_minutes && ` · ${svc.duration_minutes} min`}
                  {!svc.is_active && ' · Inactive'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditing(svc); setShowForm(true); }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(svc)}
                  title={svc.is_active ? 'Deactivate' : 'Activate'}
                  className={`transition-colors ${svc.is_active ? 'text-blue-500 hover:text-gray-400' : 'text-gray-300 hover:text-blue-500'}`}
                >
                  {svc.is_active
                    ? <ToggleRight className="w-6 h-6" />
                    : <ToggleLeft  className="w-6 h-6" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ServiceForm
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
