import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Package, Settings, LogOut,
  LayoutDashboard, Receipt, Menu, X,
} from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '../store/authStore';

const NAV = [
  { to: '/pos',          label: 'POS / Sale',    icon: ShoppingCart    },
  { to: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/products',     label: 'Products',      icon: Package         },
  { to: '/transactions', label: 'Transactions',  icon: Receipt         },
  { to: '/reports',      label: 'Reports',       icon: LayoutDashboard },
  { to: '/settings',     label: 'Settings',      icon: Settings        },
];

export default function Layout() {
  const user     = useAuthStore((s) => s.user);
  const logout   = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar – desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">
              {user?.shop_name || 'POS System'}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.username}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                 transition-colors ${isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'}`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-gray-100">
          {user?.read_only && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 mb-1 text-xs text-yellow-700
                            bg-yellow-50 rounded-lg">
              ⚠️ Read-only mode
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm
                       font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b
                      border-gray-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">{user?.shop_name || 'POS'}</span>
        </div>
        <button
          className="p-2 rounded hover:bg-gray-100 text-gray-600"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute left-0 top-14 bottom-0 w-56 bg-white border-r border-gray-200
                       flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
              {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                     ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600'}`
                  }
                >
                  <Icon className="w-4 h-4" /> {label}
                </NavLink>
              ))}
            </nav>
            <div className="px-2 py-3 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm
                           text-gray-600 hover:bg-gray-100"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 md:pt-0 pt-14">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
