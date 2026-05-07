import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, Package, Settings, LogOut,
  LayoutDashboard, Receipt, Menu, X, CreditCard,
  ClipboardList, BarChart2, MoreHorizontal, TrendingUp,
  PanelLeftClose, PanelLeftOpen, QrCode, Users,
  RotateCcw, GitBranch, AlertTriangle,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import useAuthStore from '../store/authStore';
import ConnectionStatus, { ConnectionDot } from './ConnectionStatus';
import NotificationBell from './NotificationBell';
import SubscriptionStatusBar from './SubscriptionStatusBar';
import { syncPending, cacheUserSubscription } from '../utils/syncService';
import { preOrdersApi } from '../api/client';

// Full sidebar nav (base - clothing extras injected at render time)
const NAV_BASE = [
  { to: '/pos',          label: 'POS / Sale',   icon: ShoppingCart                                                       },
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard                                                    },
  { to: '/products',     label: 'Products',     icon: Package                                                            },
  { to: '/transactions', label: 'Transactions', icon: Receipt                                                            },
  { to: '/reports',      label: 'Reports',      icon: BarChart2,     feature: 'reports_enabled'                         },
  { to: '/analytics',    label: 'Analytics',    icon: TrendingUp,    feature: 'analytics_enabled'                       },
  { to: '/billing',      label: 'Billing',      icon: CreditCard                                                         },
  { to: '/audit-log',    label: 'Audit Log',    icon: ClipboardList, roles: ['owner', 'manager']                         },
  { to: '/pre-orders',   label: 'Pre Orders',   icon: QrCode,        feature: 'pre_orders_enabled'                      },
  { to: '/customers',    label: 'Customers',    icon: Users,         roles: ['owner', 'manager'], feature: 'customers_enabled' },
  { to: '/settings',     label: 'Settings',     icon: Settings                                                           },
];

// Extra nav items shown only for clothing shop type
const NAV_CLOTHING = [
  { to: '/exchanges',          label: 'Exchanges',      icon: RotateCcw,  feature: 'exchanges_enabled'                  },
  { to: '/clothing-analytics', label: 'Clothing Stats', icon: TrendingUp                                                 },
  { to: '/branches',           label: 'Branches',       icon: GitBranch,  roles: ['owner'], feature: 'branches_enabled' },
];

// Bottom tab bar - 4 main items + "More" sheet
const BOTTOM_TABS = [
  { to: '/pos',          label: 'POS',        icon: ShoppingCart    },
  { to: '/dashboard',    label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/products',     label: 'Products',   icon: Package         },
  { to: '/transactions', label: 'Orders',     icon: Receipt         },
];

// "More" sheet items (everything not in BOTTOM_TABS)
const MORE_NAV_BASE = [
  { to: '/reports',      label: 'Reports',    icon: BarChart2,     feature: 'reports_enabled'                         },
  { to: '/analytics',    label: 'Analytics',  icon: TrendingUp,    feature: 'analytics_enabled'                       },
  { to: '/billing',      label: 'Billing',    icon: CreditCard                                                         },
  { to: '/audit-log',    label: 'Audit Log',  icon: ClipboardList, roles: ['owner', 'manager']                         },
  { to: '/pre-orders',   label: 'Pre Orders', icon: QrCode,        feature: 'pre_orders_enabled'                      },
  { to: '/customers',    label: 'Customers',  icon: Users,         roles: ['owner', 'manager'], feature: 'customers_enabled' },
  { to: '/settings',     label: 'Settings',   icon: Settings                                                           },
];

export default function Layout() {
  const user        = useAuthStore((s) => s.user);
  const logout      = useAuthStore((s) => s.logout);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const navigate    = useNavigate();
  const location    = useLocation();

  const isClothing = user?.shop_type === 'clothing';
  const isInactive = user?.activation_status != null && user.activation_status !== 'active';

  const featureFilter = ({ roles, feature }) =>
    (!roles || roles.includes(user?.role)) &&
    (!feature || user?.[feature] !== false);

  const baseFiltered     = isClothing ? NAV_BASE.filter((n) => n.to !== '/analytics')      : NAV_BASE;
  const moreBaseFiltered = isClothing ? MORE_NAV_BASE.filter((n) => n.to !== '/analytics') : MORE_NAV_BASE;
  const fullNAV      = isClothing ? [...baseFiltered,     ...NAV_CLOTHING] : baseFiltered;
  const fullMORE_NAV = isClothing ? [...moreBaseFiltered, ...NAV_CLOTHING] : moreBaseFiltered;

  // Inactive shops see only the Billing nav item
  const NAV      = isInactive ? fullNAV.filter((n) => n.to === '/billing') : fullNAV.filter(featureFilter);
  const MORE_NAV = isInactive ? []                                          : fullMORE_NAV.filter(featureFilter);

  // Desktop hamburger (kept for very narrow viewports or overflow)
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Mobile "More" bottom sheet
  const [moreOpen,   setMoreOpen]   = useState(false);
  // Collapsible desktop sidebar
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === 'true'
  );
  // Pending pre-order badge count
  const [pendingCount, setPendingCount] = useState(0);
  const pollBadgeRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const fetchPending = () =>
      preOrdersApi.list('PENDING')
        .then((res) => setPendingCount((res.data.orders || []).length))
        .catch(() => {});
    fetchPending();
    pollBadgeRef.current = setInterval(fetchPending, 15000);
    return () => clearInterval(pollBadgeRef.current);
  }, [user]);

  function toggleSidebar() {
    setCollapsed((v) => {
      localStorage.setItem('sidebarCollapsed', String(!v));
      return !v;
    });
  }

  // Refresh subscription state once on mount (online only)
  useEffect(() => {
    if (navigator.onLine) refreshUser();
  }, []); // eslint-disable-line

  // Cache subscription + auto-sync
  useEffect(() => {
    if (user) cacheUserSubscription(user);
    if (navigator.onLine) syncPending();

    function onFocus()  { if (navigator.onLine) syncPending(); }
    function onOnline() { syncPending(); refreshUser(); }
    window.addEventListener('focus',  onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('focus',  onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [user]); // eslint-disable-line

  // Close "More" sheet on route change
  useEffect(() => { setMoreOpen(false); setDrawerOpen(false); }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const moreActive = MORE_NAV.some((n) => location.pathname.startsWith(n.to));

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200
                         fixed inset-y-0 left-0 z-20 h-screen
                         transition-all duration-300 ease-in-out
                         ${collapsed ? 'w-14' : 'w-56'}`}>

        {/* Brand */}
        <div className={`flex items-center border-b border-gray-100 shrink-0
                         ${collapsed ? 'justify-center px-0 py-4' : 'justify-between px-4 py-4'}`}>
          {collapsed ? (
            /* Collapsed: just the icon, acts as toggle too */
            <button
              onClick={toggleSidebar}
              title="Expand sidebar"
              className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center"
            >
              <ShoppingCart className="w-4 h-4 text-white" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {user?.shop_name || 'POS System'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user?.username}</p>
                </div>
              </div>
              <NotificationBell align="left" />
            </>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto
                         ${collapsed ? 'px-1' : 'px-2'}`}>
          {NAV
            .filter(featureFilter)
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-lg text-sm font-medium transition-colors
                   ${collapsed
                    ? 'justify-center p-2'
                    : 'gap-2.5 px-3 py-2'}
                   ${isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'}`
                }
              >
                <div className="relative shrink-0">
                  <Icon className="w-4 h-4" />
                  {to === '/pre-orders' && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>
                {!collapsed && label}
                {!collapsed && to === '/pre-orders' && pendingCount > 0 && (
                  <span className="ml-auto bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            ))
          }
        </nav>

        {/* Footer */}
        <div className={`py-3 border-t border-gray-100 space-y-1
                         ${collapsed ? 'px-1' : 'px-2'}`}>
          {!collapsed && (
            <div className="px-1">
              <ConnectionStatus />
            </div>
          )}
          {!collapsed && user?.read_only && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-yellow-700
                            bg-yellow-50 rounded-lg">
              Read-only mode
            </div>
          )}

          {/* Sign out */}
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

          {/* Collapse / expand toggle */}
          <button
            onClick={toggleSidebar}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex items-center w-full rounded-lg text-xs font-medium
                        text-gray-400 hover:bg-gray-100 transition-colors
                        ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'}`}
          >
            {collapsed
              ? <PanelLeftOpen  className="w-4 h-4 shrink-0" />
              : <PanelLeftClose className="w-4 h-4 shrink-0" />
            }
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b
                      border-gray-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm truncate max-w-[140px]">
            {user?.shop_name || 'POS'}
          </span>
          <ConnectionDot />
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
        </div>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────── */}
      {/* safe-area-bottom adds env(safe-area-inset-bottom) padding so the bar
          extends into the iPhone home-indicator zone with the correct bg color */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t
                      border-gray-200 safe-area-bottom">
        <div className="flex h-14">
          {isInactive ? (
            /* Inactive: show only Billing tab */
            <NavLink
              to="/billing"
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium
                 transition-colors ${isActive ? 'text-primary-600' : 'text-gray-500'}`
              }
            >
              {({ isActive }) => (
                <>
                  <CreditCard className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                  Billing
                </>
              )}
            </NavLink>
          ) : (
            <>
              {BOTTOM_TABS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium
                     transition-colors ${isActive
                      ? 'text-primary-600'
                      : 'text-gray-500 hover:text-gray-700'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
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
                            ${moreActive ? 'text-primary-600' : 'text-gray-500'}`}
              >
                <MoreHorizontal className={`w-5 h-5 ${moreActive ? 'text-primary-600' : 'text-gray-400'}`} />
                More
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── "More" bottom sheet ───────────────────────────────── */}
      {moreOpen && !isInactive && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute left-0 right-0 bg-white border-t border-gray-200
                       rounded-t-2xl pb-2 bottom-safe-tab"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-3">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Scrollable nav list - max 65vh so it never overflows small screens */}
            <nav className="px-2 space-y-0.5 overflow-y-auto max-h-[65vh]">
              {MORE_NAV
                .filter(featureFilter)
                .map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                       transition-colors ${isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-50'}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                        {label}
                        {to === '/pre-orders' && pendingCount > 0 && (
                          <span className="ml-auto bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                            {pendingCount}
                          </span>
                        )}
                      </>
                    )}
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
      {/* pb-safe-tab = 3.5rem (tab bar) + env(safe-area-inset-bottom) */}
      <main className={`flex-1 min-w-0 pt-14 pb-safe-tab md:pt-0 md:pb-0
                        transition-all duration-300 ease-in-out
                        ${collapsed ? 'md:ml-14' : 'md:ml-56'}`}>

        {/* Activation required banner */}
        {isInactive && (
          <div className="bg-amber-500 text-white px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Complete payment to activate your account</p>
              <p className="text-xs opacity-90">Your account is pending activation. Upload a payment proof on the Billing page to get started.</p>
            </div>
          </div>
        )}

        <SubscriptionStatusBar />
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
