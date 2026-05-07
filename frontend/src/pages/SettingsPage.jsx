import { useState, useEffect } from 'react';
import { Save, Loader2, Package, ToggleLeft, ToggleRight, AlertTriangle, Printer, Percent, Barcode, Smartphone, Usb, ChevronDown, ChevronUp, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi, authApi, qrPaymentsApi } from '../api/client';
import useAuthStore from '../store/authStore';
import { getReceiptSize, setReceiptSize, getAutoPrint, setAutoPrint } from '../utils/receipt';

function SubscriptionBanner({ user }) {
  if (!user) return null;
  const { subscription_status, subscription_end_date } = user;

  const daysLeft = subscription_end_date
    ? Math.ceil((new Date(subscription_end_date) - Date.now()) / 86_400_000)
    : null;

  const statusMap = {
    active:  { cls: 'badge-active',   label: 'Active'  },
    trial:   { cls: 'badge-active',   label: 'Active'  },
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
  const [products, setProducts]           = useState([]);
  const [loadingProds, setLoadingProds]   = useState(false);
  const [togglingId,   setTogglingId]     = useState(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);

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

      {/* Default tax rate (owner only) */}
      {canEdit && <TaxRateSettings />}

      {/* Account info */}
      <div className="card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Account</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span className="text-gray-500">Shop</span>
          <span className="font-medium">{user?.shop_name}</span>
          <span className="text-gray-500">Shop ID</span>
          <span className="font-mono flex items-center gap-2">
            {user?.shop_reference_id || `SHP-${String(user?.shop_id).padStart(6,'0')}`}
            <button
              type="button"
              className="text-xs text-primary-600 hover:underline"
              onClick={() => {
                const ref = user?.shop_reference_id || `SHP-${String(user?.shop_id).padStart(6,'0')}`;
                navigator.clipboard.writeText(ref).then(() => toast.success('Shop ID copied'));
              }}
            >Copy</button>
          </span>
          <span className="col-span-2 text-xs text-gray-400 -mt-1">
            Share this ID with cashier/manager staff so they can log in when prompted.
          </span>
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
        {/* Clickable header to expand/collapse */}
        <button
          onClick={() => setInventoryOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Inventory Tracking per Product</h2>
            {!loadingProds && products.length > 0 && (
              <span className="text-xs text-gray-400 font-normal">
                ({products.filter((p) => p.has_inventory).length}/{products.length} tracked)
              </span>
            )}
          </div>
          {inventoryOpen
            ? <ChevronUp   className="w-4 h-4 text-gray-400 shrink-0" />
            : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          }
        </button>

        {/* Collapsible body */}
        {inventoryOpen && (
          <>
            {loadingProds ? (
              <div className="flex items-center justify-center py-8 text-gray-400 border-t border-gray-100">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 border-t border-gray-100 max-h-80 overflow-y-auto">
                {products.length === 0 && (
                  <li className="text-center py-8 text-gray-400 text-sm">No products yet.</li>
                )}
                {products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0 flex-1 mr-4">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      {p.category && <p className="text-xs text-gray-400">{p.category}</p>}
                    </div>
                    <button
                      onClick={() => toggleInventory(p)}
                      disabled={!canEdit || togglingId === p.id}
                      className="flex items-center gap-1.5 text-sm disabled:opacity-50 shrink-0"
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
          </>
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

      {/* ── Scanner Mode (when barcode is enabled) ───────────── */}
      {user?.barcode_enabled && <ScannerModeSettings />}

      {/* ── Receipt Settings ─────────────────────────────────── */}
      <ReceiptSettings />

      {/* ── QR Payments / HelaPOS (owner only) ───────────────── */}
      {user?.role === 'owner' && <HelaPOSSettings />}
    </div>
  );
}

function ScannerModeSettings() {
  const [mode, setMode] = useState(() => localStorage.getItem('scannerMode') || 'both');

  function handleMode(val) {
    setMode(val);
    localStorage.setItem('scannerMode', val);
    toast.success('Scanner mode saved');
  }

  const OPTIONS = [
    {
      value: 'usb',
      label: 'USB Scanner',
      desc: 'Hardware barcode scanner via keyboard input',
    },
    {
      value: 'phone',
      label: 'Phone Camera',
      desc: 'Wireless scanning from your phone',
    },
    {
      value: 'both',
      label: 'Both',
      desc: 'Use either method (recommended)',
    },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <Barcode className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700">Barcode Scanner Mode</h2>
      </div>
      <div className="px-4 py-4 space-y-3">
        <p className="text-xs text-gray-500">
          Choose which barcode scanning methods appear on the POS page.
          Changes take effect immediately on next POS visit.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => handleMode(value)}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border
                          text-xs font-medium transition-colors text-center
                          ${mode === value
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <span className="font-semibold">{label}</span>
              <span className={`text-[10px] leading-tight ${mode === value ? 'text-primary-500' : 'text-gray-400'}`}>
                {desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaxRateSettings() {
  const user        = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [rate,    setRate]    = useState(String(user?.default_tax_rate ?? 0));
  const [saving,  setSaving]  = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateSettings({ default_tax_rate: parseFloat(rate) || 0 });
      await refreshUser();
      toast.success('Default tax rate saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <Percent className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700">Default Tax Rate</h2>
      </div>
      <form onSubmit={handleSave} className="px-4 py-4 space-y-3">
        <p className="text-xs text-gray-500">
          New products will use this tax rate by default. You can override it per product.
        </p>
        <div className="flex items-center gap-3">
          <div className="relative w-32">
            <input
              className="input pr-7"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
          </div>
          <button type="submit" className="btn-primary text-sm py-2" disabled={saving}>
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              : <><Save className="w-3.5 h-3.5" /> Save</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}

function ReceiptSettings() {
  const [size,      setSize]      = useState(getReceiptSize);
  const [autoPrint, setAutoPrint_] = useState(getAutoPrint);

  function handleSize(val) {
    setSize(val);
    setReceiptSize(val);
    toast.success('Receipt size saved');
  }

  function handleAutoPrint(e) {
    const v = e.target.checked;
    setAutoPrint_(v);
    setAutoPrint(v);
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <Printer className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700">Receipt Settings</h2>
      </div>
      <div className="px-4 py-4 space-y-4">
        <div>
          <label className="label">Receipt size</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: '80mm', label: '80mm Thermal' },
              { id: '58mm', label: '58mm Thermal' },
              { id: 'a4',   label: 'A4 Paper' },
            ].map(({ id, label }) => (
              <button
                key={id}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-xs
                  font-medium transition-colors
                  ${size === id
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                onClick={() => handleSize(id)}
              >
                <Printer className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded accent-primary-600"
            checked={autoPrint}
            onChange={handleAutoPrint}
          />
          <div>
            <p className="text-sm font-medium text-gray-700">Auto-print after sale</p>
            <p className="text-xs text-gray-400">Opens browser print dialog automatically</p>
          </div>
        </label>
      </div>
    </div>
  );
}

function HelaPOSSettings() {
  const [open,    setOpen]    = useState(false);
  const [config,  setConfig]  = useState({ app_id: '', app_secret: '', business_id: '' });
  const [status,  setStatus]  = useState(null); // null | 'configured' | 'not_configured'
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || status !== null) return;
    setLoading(true);
    qrPaymentsApi.getConfig()
      .then(({ data }) => {
        setStatus(data.configured ? 'configured' : 'not_configured');
        if (data.configured) setConfig((c) => ({ ...c, app_id: data.app_id || '', business_id: data.business_id || '' }));
      })
      .catch(() => setStatus('not_configured'))
      .finally(() => setLoading(false));
  }, [open, status]);

  async function handleSave(e) {
    e.preventDefault();
    if (!config.app_id || !config.app_secret || !config.business_id) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      await qrPaymentsApi.saveConfig(config);
      toast.success('HelaPOS credentials saved');
      setStatus('configured');
      setConfig((c) => ({ ...c, app_secret: '' }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">QR Payments (HelaPOS / LankaQR)</h2>
          {status === 'configured' && (
            <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Configured</span>
          )}
          {status === 'not_configured' && (
            <span className="text-xs font-medium text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">Not configured</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <form onSubmit={handleSave} className="space-y-3">
              <p className="text-xs text-gray-500">
                Enter your HelaPOS merchant credentials to enable LankaQR payments.
                Contact <a href="mailto:support@helapay.lk" className="text-primary-600 underline">support@helapay.lk</a> to obtain credentials.
              </p>
              <div>
                <label className="label">App ID</label>
                <input
                  className="input"
                  placeholder="Your HelaPOS App ID"
                  value={config.app_id}
                  onChange={(e) => setConfig((c) => ({ ...c, app_id: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">App Secret</label>
                <input
                  className="input"
                  type="password"
                  placeholder={status === 'configured' ? '••••••••  (leave blank to keep existing)' : 'Your HelaPOS App Secret'}
                  value={config.app_secret}
                  onChange={(e) => setConfig((c) => ({ ...c, app_secret: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Business ID</label>
                <input
                  className="input"
                  placeholder="Your HelaPOS Business ID"
                  value={config.business_id}
                  onChange={(e) => setConfig((c) => ({ ...c, business_id: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-sm py-2 flex items-center gap-1.5" disabled={saving || testing}>
                  {saving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                    : <><Save className="w-3.5 h-3.5" /> Save Credentials</>
                  }
                </button>
                {status === 'configured' && (
                  <button
                    type="button"
                    className="btn-secondary text-sm py-2 flex items-center gap-1.5"
                    disabled={saving || testing}
                    onClick={async () => {
                      setTesting(true);
                      try {
                        await qrPaymentsApi.testConnection();
                        toast.success('HelaPOS connection OK - credentials are valid');
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Connection failed - check credentials');
                      } finally {
                        setTesting(false);
                      }
                    }}
                  >
                    {testing
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing…</>
                      : 'Test Connection'
                    }
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
