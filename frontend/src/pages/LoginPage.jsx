import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login    = useAuthStore((s) => s.login);
  const loading  = useAuthStore((s) => s.loading);

  const [form, setForm]     = useState({ shop_id: '', username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.shop_id || !form.username || !form.password) {
      setError('All fields are required');
      return;
    }

    try {
      const data = await login({
        shop_id:  parseInt(form.shop_id, 10),
        username: form.username.trim(),
        password: form.password,
      });

      if (data.user.read_only) {
        toast('Logged in as read-only - subscription expired', { icon: '⚠️' });
      } else {
        toast.success(`Welcome, ${data.user.username}!`);
      }
      navigate('/products');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600
                      flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative background circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -right-20 w-[28rem] h-[28rem] bg-white/5 rounded-full" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 bg-primary-400/20 rounded-full" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* White card so the logo is always legible against the dark-blue gradient */}
          <div className="bg-white rounded-2xl px-10 py-6 mb-8 shadow-2xl">
            <img
              src="/logo.png"
              alt="BillFlow"
              className="h-28 w-auto object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">BillFlow</h1>
          <p className="text-primary-200 text-lg max-w-xs leading-relaxed">
            Manage your shop with ease. Sales, inventory, and reports in one place.
          </p>
        </div>

        <p className="absolute bottom-8 text-primary-300 text-sm">
          &copy; {new Date().getFullYear()} BillFlow. All rights reserved.
        </p>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        {/* Mobile-only logo */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <img
            src="/logo.png"
            alt="BillFlow"
            className="h-14 w-auto mb-3 object-contain"
          />
          <h1 className="text-2xl font-bold text-primary-900">BillFlow</h1>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to your shop account</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200
                            text-red-700 rounded-lg px-3 py-2 text-sm mb-4">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Shop ID</label>
              <input
                className="input"
                type="number"
                min="1"
                placeholder="Enter your Shop ID (e.g. 1)"
                value={form.shop_id}
                onChange={set('shop_id')}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">
                Your Shop ID is provided when your account is created.
              </p>
            </div>

            <div>
              <label className="label">Username</label>
              <input
                className="input"
                type="text"
                placeholder="Enter username"
                value={form.username}
                onChange={set('username')}
                autoComplete="username"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center py-3 text-base"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-gray-400 text-xs mt-8">
            Need help? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
