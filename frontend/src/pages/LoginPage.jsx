import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const navigate  = useNavigate();
  const login     = useAuthStore((s) => s.login);
  const loading   = useAuthStore((s) => s.loading);

  const [form, setForm]       = useState({ shop_id: '', username: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');

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
        toast('Logged in as read-only — subscription expired', { icon: '⚠️' });
      } else {
        toast.success(`Welcome, ${data.user.username}!`);
      }
      navigate('/products');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-primary-500
                    flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20
                          rounded-2xl backdrop-blur mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">POS System</h1>
          <p className="text-primary-200 text-sm mt-1">Sign in to your shop</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200
                            text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Shop ID */}
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

            {/* Username */}
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

            {/* Password */}
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                             hover:text-gray-600"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center py-2.5"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-primary-200 text-xs mt-6">
          Need help? Contact your system administrator.
        </p>
      </div>
    </div>
  );
}
