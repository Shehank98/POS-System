import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Pencil, X, GitMerge } from 'lucide-react';
import toast from 'react-hot-toast';
import { clothingApi } from '../api/client';
import useAuthStore from '../store/authStore';

const fmt = (n) => Number(n || 0).toFixed(2);

// ── Branch form (create / edit) ──────────────────────────────
function BranchForm({ branch, onSaved, onClose }) {
  const [form, setForm] = useState({
    name:    branch?.name    || '',
    address: branch?.address || '',
    phone:   branch?.phone   || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (branch) {
        await clothingApi.updateBranch(branch.id, form);
        toast.success('Branch updated');
      } else {
        await clothingApi.createBranch(form);
        toast.success('Branch created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{branch ? 'Edit Branch' : 'New Branch'}</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-500 block mb-0.5">Branch Name *</label>
          <input className="input w-full py-1.5" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-500 block mb-0.5">Address</label>
          <input className="input w-full py-1.5" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">Phone</label>
          <input className="input w-full py-1.5" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-1.5">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5">
            {saving ? 'Saving…' : branch ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Inventory table for a branch ─────────────────────────────
function BranchInventoryPanel({ branch }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    clothingApi.getBranchInventory(branch.id)
      .then(({ data }) => setItems(data.inventory || []))
      .catch(() => toast.error('Failed to load inventory'))
      .finally(() => setLoading(false));
  }, [branch.id]);

  if (loading) return <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>;
  if (!items.length) return <p className="text-sm text-gray-400 py-4 text-center">No inventory assigned.</p>;

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase">
            <th className="pb-1.5 text-left pr-3">Product</th>
            <th className="pb-1.5 text-left pr-3">Size / Color</th>
            <th className="pb-1.5 text-right">Stock</th>
            <th className="pb-1.5 text-right pr-3">Threshold</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((inv) => (
            <tr key={inv.variant_id} className="hover:bg-gray-50">
              <td className="py-2 pr-3 font-medium text-gray-800 truncate max-w-[120px]">
                {inv.product_name}
              </td>
              <td className="py-2 pr-3 text-gray-500">{inv.size} / {inv.color}</td>
              <td className="py-2 text-right">
                <span className={`font-semibold
                  ${inv.stock_quantity <= 0 ? 'text-red-600'
                    : inv.stock_quantity <= inv.low_stock_threshold ? 'text-amber-600'
                    : 'text-gray-700'}`}>
                  {inv.stock_quantity}
                </span>
              </td>
              <td className="py-2 text-right pr-3 text-gray-400">{inv.low_stock_threshold}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Stock Transfer modal ─────────────────────────────────────
function TransferModal({ branches, onClose, onDone }) {
  const [form, setForm] = useState({
    from_branch_id: '',
    to_branch_id:   '',
    variant_id:     '',
    quantity:       1,
    note:           '',
  });
  const [fromInventory, setFromInventory] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function onFromChange(id) {
    set('from_branch_id', id);
    set('variant_id', '');
    if (!id) { setFromInventory([]); return; }
    setLoadingInv(true);
    try {
      const { data } = await clothingApi.getBranchInventory(id);
      setFromInventory((data.inventory || []).filter((i) => i.stock_quantity > 0));
    } catch { toast.error('Failed to load source inventory'); }
    finally { setLoadingInv(false); }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.from_branch_id || !form.to_branch_id || !form.variant_id || form.quantity < 1) {
      toast.error('Fill all required fields'); return;
    }
    if (form.from_branch_id === form.to_branch_id) {
      toast.error('Source and destination must differ'); return;
    }
    setSaving(true);
    try {
      await clothingApi.transferStock({
        from_branch_id: parseInt(form.from_branch_id, 10),
        to_branch_id:   parseInt(form.to_branch_id, 10),
        variant_id:     parseInt(form.variant_id, 10),
        quantity:       parseInt(form.quantity, 10),
        note:           form.note,
      });
      toast.success('Stock transferred');
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-primary-600" /> Stock Transfer
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">From Branch *</label>
              <select className="input w-full py-1.5 text-sm"
                      value={form.from_branch_id}
                      onChange={(e) => onFromChange(e.target.value)}>
                <option value="">Select…</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">To Branch *</label>
              <select className="input w-full py-1.5 text-sm"
                      value={form.to_branch_id}
                      onChange={(e) => set('to_branch_id', e.target.value)}>
                <option value="">Select…</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Variant *</label>
            {loadingInv
              ? <p className="text-xs text-gray-400">Loading…</p>
              : (
                <select className="input w-full py-1.5 text-sm"
                        value={form.variant_id}
                        onChange={(e) => set('variant_id', e.target.value)}>
                  <option value="">Select…</option>
                  {fromInventory.map((i) => (
                    <option key={i.variant_id} value={i.variant_id}>
                      {i.product_name} - {i.size}/{i.color} (stock: {i.stock_quantity})
                    </option>
                  ))}
                </select>
              )
            }
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Quantity *</label>
            <input type="number" min="1" className="input w-full py-1.5 text-sm"
                   value={form.quantity}
                   onChange={(e) => set('quantity', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Note</label>
            <input className="input w-full py-1.5 text-sm" value={form.note}
                   onChange={(e) => set('note', e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-1.5">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5">
              {saving ? 'Transferring…' : 'Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Branch card ──────────────────────────────────────────────
function BranchCard({ branch, canEdit, onRefresh }) {
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{branch.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {branch.address || ''}
            {branch.phone && ` · ${branch.phone}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            {open ? 'Hide Inventory' : 'View Inventory'}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4">
          <BranchInventoryPanel branch={branch} />
        </div>
      )}

      {editing && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <BranchForm branch={branch} onSaved={onRefresh} onClose={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function BranchManagementPage() {
  const user    = useAuthStore((s) => s.user);
  const canEdit = !user?.read_only && ['owner', 'manager'].includes(user?.role);

  const [branches,    setBranches]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await clothingApi.listBranches();
      setBranches(data.branches || []);
    } catch { toast.error('Failed to load branches'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">Branch Management</h1>
        <div className="flex items-center gap-2">
          {canEdit && branches.length >= 2 && (
            <button
              onClick={() => setShowTransfer(true)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <GitMerge className="w-4 h-4" /> Transfer Stock
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Add Branch
            </button>
          )}
          <button onClick={load} disabled={loading} className="btn-secondary h-9 w-9 p-0 flex items-center justify-center">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {showAdd && (
        <BranchForm
          onSaved={load}
          onClose={() => setShowAdd(false)}
        />
      )}

      {loading && !branches.length ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No branches yet.{canEdit && ' Click "Add Branch" to create one.'}
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((b) => (
            <BranchCard key={b.id} branch={b} canEdit={canEdit} onRefresh={load} />
          ))}
        </div>
      )}

      {showTransfer && (
        <TransferModal
          branches={branches}
          onClose={() => setShowTransfer(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
