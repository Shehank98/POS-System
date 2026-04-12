import { useState, useEffect } from 'react';
import { Save, Loader2, Package, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi, authApi } from '../api/client';
import useAuthStore from '../store/authStore';

function SubscriptionBanner({ user }) {
  if (!user) return null;
  const { subscription_status, subscription_end_date } = user;

  const daysLeft = subscription_end_date
    ? Math.ceil((new Date(subscription_end_date) - Date.now()) / 86_400_000)
    : null;

  const statusMap = {
    active:  { cls: 'badge-active',   label: 'Active'  },
    trial:   { cls: 'badge-trial',    label: 'Trial'   },
    expired: { cls: 'badge-expired',  label: 'Expired' },
  };
  const s = statusMap[subscription_status] || statusMap.expired;

  return (
    <div className="card p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700">Subscription</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {subscription_end_date
            ? `Expires ${new Date(subscription_end_date).toLocaleDateString()}`
            : 'No expiry date set'}
          {daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
            <span className="ml-2 text-yellow-600">
              <AlertTriangle className="w-3.5 h-3.5 inline" /> {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
            </span>
          )}
        </p>
      </div>
      <span className={s.cls}>{s.label}</span>
    </div>
  );
}

export default function SettingsPage() {
  const user        = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const canEdit     = !user?.read_only && user?.role === 'owner';

  // ── Inventory toggle per product ────────────────────────────
  const [products, setProducts] = useState([]);
  const [loadingProds, setLoadingProds] = useState(false);
  const [togglingId,   setTogglingId]   = useState(null);

  useEffect(() => {
    setLoadingProds(true);
    productsApi.list({ limit: 200 })
      .then(({ data }) => setProducts(data.products))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoadingProds(false));
  }, []);

  async function toggleInventory(product) {
    if (!canEdit) return;
    setTogglingId(product.id);
    try {
      const { data } = await productsApi.update(product.id, {
        has_inventory: !product.has_inventory,
      });
      setProducts((prev) => prev.map((p) => p.id === product.id ? data : p));
    } catch {
      toast.error('Failed to update');
    } finally {
      setTogglingId(null);
    }
  }

  // ── Staff management ─────────────────────────────────────────
  const [staff,     setStaff]     = useState([]);
  const [newUser,   setNewUser]   = useState({ username: '', password: '', role: 'cashier' });
  const [addingUser, setAddingUser] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    if (user?.role === 'owner' || user?.role === 'manager') {
      authApi.listUsers()
        .then(({ data }) => setStaff(data))
        .catch(() => {});
    }
  }, [user]);

  async function handleAddUser(e) {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      toast.error('Username and password are required');
      return;
    }
    setSavingUser(true);
    try {
      await authApi.registerUser(newUser);
      toast.success('User created');
      setNewUser({ username: '', password: '', role: 'cashier' });
      setAddingUser(false);
      const { data } = await authApi.listUsers();
      setStaff(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDeleteUser(id) {
    if (!window.confirm('Delete this user?')) return;
    try {
      await authApi.deleteUser(id);
      setStaff((prev) => prev.filter((u) => u.id !== id));
      toast.success('User removed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  }

  const setU = (f) => (e) => setNewUser((u) => ({ ...u, [f]: e.target.value }));

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      {/* Subscription info */}
      <SubscriptionBanner user={user} />

      {/* Account info */}
      <div className="card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Account</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span className="text-gray-500">Shop</span>
          <span className="font-medium">{user?.shop_name}</span>
          <span className="text-gray-500">Shop ID</span>
          <span className="font-mono">{user?.shop_id}</span>
          <span className="text-gray-500">Username</span>
          <span className="font-medium">{user?.username}</span>
          <span className="text-gray-500">Role</span>
          <span className="capitalize">{user?.role}</span>
          <span className="text-gray-500">Barcode scanner</span>
          <span>{user?.barcode_enabled ? '✓ Enabled' : '✗ Disabled'}</span>
        </div>
      </div>

      {/* Per-product inventory toggle */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Inventory Tracking per Product</h2>
        </div>
        {loadingProds ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {products.length === 0 && (
              <li className="text-center py-8 text-gray-400 text-sm">No products yet.</li>
            )}
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  {p.category && <p className="text-xs text-gray-400">{p.category}</p>}
                </div>
                <button
                  onClick={() => toggleInventory(p)}
                  disabled={!canEdit || togglingId === p.id}
                  className="flex items-center gap-1.5 text-sm disabled:opacity-50"
                  title={p.has_inventory ? 'Click to disable inventory tracking' : 'Click to enable'}
                >
                  {togglingId === p.id
                    ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    : p.has_inventory
                      ? <ToggleRight className="w-6 h-6 text-primary-600" />
                      : <ToggleLeft  className="w-6 h-6 text-gray-300" />
                  }
                  <span className={p.has_inventory ? 'text-primary-600' : 'text-gray-400'}>
                    {p.has_inventory ? 'Tracked' : 'Unlimited'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Staff management (owner/manager only) */}
      {(user?.role === 'owner' || user?.role === 'manager') && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Staff Accounts</h2>
            {canEdit && (
              <button
                className="btn-secondary text-xs py-1 px-2"
                onClick={() => setAddingUser((v) => !v)}
              >
                {addingUser ? 'Cancel' : '+ Add User'}
              </button>
            )}
          </div>

          {addingUser && (
            <form onSubmit={handleAddUser} className="px-4 py-3 bg-gray-50 border-b
                                                       border-gray-100 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <input
                  className="input col-span-1"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={setU('username')}
                  autoFocus
                />
                <input
                  className="input col-span-1"
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={setU('password')}
                />
                <select className="input col-span-1" value={newUser.role} onChange={setU('role')}>
                  {user.role === 'owner' && <option value="manager">Manager</option>}
                  <option value="cashier">Cashier</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="submit" className="btn-primary text-xs py-1.5" disabled={savingUser}>
                  {savingUser
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                    : <><Save className="w-3.5 h-3.5" /> Create User</>
                  }
                </button>
              </div>
            </form>
          )}

          <ul className="divide-y divide-gray-100">
            {staff.length === 0 && (
              <li className="text-center py-6 text-gray-400 text-sm">No staff accounts.</li>
            )}
            {staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.username}</p>
                  <p className="text-xs text-gray-400 capitalize">{s.role}</p>
                </div>
                {canEdit && s.id !== user?.id && s.role !== 'owner' && (
                  <button
                    className="text-xs text-red-500 hover:text-red-700"
                    onClick={() => handleDeleteUser(s.id)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
