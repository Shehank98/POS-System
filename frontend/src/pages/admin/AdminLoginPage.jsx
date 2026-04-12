import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/client';
import useAdminStore from '../../store/adminStore';

export default function AdminLoginPage() {
  const login    = useAdminStore((s) => s.login);
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await adminApi.login({ email, password });
      login(data.token);
      navigate('/admin', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Super Admin</h1>
          <p className="text-gray-400 text-sm mt-1">POS SaaS Management Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Admin Email</label>
            <input
              className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 text-white rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-500 text-sm"
              type="email"
              placeholder="admin@pos.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <div className="relative">
              <input
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 text-white rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-500 text-sm pr-10"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold
                       rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              : 'Sign In to Admin Panel'
            }
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-4">
          This panel is for system administrators only.
        </p>
      </div>
    </div>
  );
}
