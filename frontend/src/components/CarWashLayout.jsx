import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Car, LayoutDashboard, ClipboardList, CalendarDays,
  Wrench, Package, Users, Settings, CreditCard,
  LogOut, MoreHorizontal, Plus, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import NotificationBell from './NotificationBell';
import SubscriptionStatusBar from './SubscriptionStatusBar';

const NAV = [
  { to: '/carwash/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/carwash/jobs',      label: 'Jobs',        icon: ClipboardList   },
  { to: '/carwash/bookings',  label: 'Bookings',    icon: CalendarDays    },
  { to: '/carwash/services',  label: 'Services',    icon: Wrench,   roles: ['owner','manager'] },
  { to: '/carwash/products',  label: 'Products',    icon: Package,  roles: ['owner','manager'] },
  { to: '/carwash/staff',     label: 'My Jobs',     icon: Users           },
  { to: '/carwash/billing',   label: 'Billing',     icon: CreditCard, roles: ['owner'] },
  { to: '/carwash/settings',  label: 'Settings',    icon: Settings,   roles: ['owner'] },
];

const BOTTOM_TABS = [
  { to: '/carwash/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/carwash/jobs',      label: 'Jobs',       icon: ClipboardList   },
  { to: '/carwash/bookings',  label: 'Bookings',   icon: CalendarDays    },
];

const MORE_NAV = [
  { to: '/carwash/services', label: 'Services', icon: Wrench,    roles: ['owner','manager'] },
  { to: '/carwash/products', label: 'Products', icon: Package,   roles: ['owner','manager'] },
  { to: '/carwash/staff',    label: 'My Jobs',  icon: Users      },
  { to: '/carwash/billing',  label: 'Billing',  icon: CreditCard, roles: ['owner'] },
  { to: '/carwash/settings', label: 'Settings', icon: Settings,  roles: ['owner'] },
];

export default function CarWashLayout() {
  const user     = useAuthStore((s) => s.user);
  const logout   = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const [moreOpen,   setMoreOpen]   = useState(false);
  const [collapsed,  setCollapsed]  = useState(
    () => localStorage.getItem('cwSidebarCollapsed') === 'true'
  );

  function toggleSidebar() {
    setCollapsed((v) => {
      localStorage.setItem('cwSidebarCollapsed', String(!v));
      return !v;
    });
  }

  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const moreActive = MORE_NAV.some((n) => location.pathname.startsWith(n.to));

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200 shrink-0
                         transition-all duration-200
                         ${collapsed ? 'w-14' : 'w-56'}`}>

        {/* Brand */}
        <div className={`flex items-center border-b border-gray-100 shrink-0
                         ${collapsed ? 'justify-center px-0 py-4' : 'justify-between px-4 py-4'}`}>
          {collapsed ? (
            <button
              onClick={toggleSidebar}
              title="Expand sidebar"
              className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"
            >
              <Car className="w-4 h-4 text-white" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                  <Car className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {user?.shop_name || 'Car Wash'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user?.username}</p>
                </div>
              </div>
              <NotificationBell align="left" />
            </>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${collapsed ? 'px-1' : 'px-2'}`}>
          {/* New Job shortcut */}
          {!collapsed && (
            <NavLink
              to="/carwash/jobs/new"
              className="flex items-center gap-2 mx-1 mb-3 px-3 py-2 bg-blue-600 hover:bg-blue-700
                         text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> New Job
            </NavLink>
          )}
          {collapsed && (
            <NavLink
              to="/carwash/jobs/new"
              title="New Job"
              className="flex items-center justify-center p-2 mb-2 bg-blue-600 hover:bg-blue-700
                         text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
            </NavLink>
          )}

          {NAV
            .filter(({ roles }) => !roles || roles.includes(user?.role))
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/carwash/dashboard'}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-lg text-sm font-medium transition-colors
                   ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'}
                   ${isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'}`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && label}
              </NavLink>
            ))
          }
        </nav>

        {/* Footer */}
        <div className={`py-3 border-t border-gray-100 space-y-1 ${collapsed ? 'px-1' : 'px-2'}`}>
          {!collapsed && user?.read_only && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-yellow-700
                            bg-yellow-50 rounded-lg">
              Read-only mode
            </div>
          )}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`flex items-center w-full rounded-lg text-sm font-medium
                        text-gray-600 hover:bg-gray-100 transition-colors
                        ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
          <button
            onClick={toggleSidebar}
            title={collapsed ? 'Expand' : 'Collapse'}
            className={`flex items-center w-full rounded-lg text-xs font-medium
                        text-gray-400 hover:bg-gray-100 transition-colors
                        ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'}`}
          >
            {collapsed
              ? <PanelLeftOpen  className="w-4 h-4 shrink-0" />
              : <PanelLeftClose className="w-4 h-4 shrink-0" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b
                      border-gray-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Car className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm truncate max-w-[140px]">
            {user?.shop_name || 'Car Wash'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <NavLink
            to="/carwash/jobs/new"
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white
                       text-xs font-semibold rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" /> New Job
          </NavLink>
        </div>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t
                      border-gray-200 safe-area-bottom">
        <div className="flex h-14">
        {BOTTOM_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/carwash/dashboard'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium
               transition-colors ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}

        {/* More button */}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px]
                      font-medium transition-colors
                      ${moreActive ? 'text-blue-600' : 'text-gray-500'}`}
        >
          <MoreHorizontal className={`w-5 h-5 ${moreActive ? 'text-blue-600' : 'text-gray-400'}`} />
          More
        </button>
        </div>{/* close inner h-14 flex */}
      </div>{/* close safe-area-bottom wrapper */}

      {/* ── "More" bottom sheet ───────────────────────────────── */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute left-0 right-0 bg-white border-t border-gray-200
                       rounded-t-2xl pb-2 bottom-safe-tab"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-3">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>
            <nav className="px-2 space-y-0.5">
              {MORE_NAV
                .filter(({ roles }) => !roles || roles.includes(user?.role))
                .map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                       transition-colors ${isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'}`
                    }
                  >
                    <Icon className="w-5 h-5 shrink-0 text-gray-400" />
                    {label}
                  </NavLink>
                ))
              }
            </nav>
            <div className="px-2 pt-2 mt-1 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm
                           font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0 md:pb-0 pb-safe-tab">
        <SubscriptionStatusBar billingPath="/carwash/billing" />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
