import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../providers/biometric_provider.dart';
import '../../providers/agent_auth_provider.dart';
import '../../providers/admin_auth_provider.dart';
import '../../data/models/product_model.dart';
import '../../data/models/transaction_model.dart';
import '../../presentation/screens/auth/login_screen.dart';
import '../../presentation/screens/auth/biometric_screen.dart';
import '../../presentation/screens/billing/billing_screen.dart';
import '../../presentation/screens/dashboard/dashboard_screen.dart';
import '../../presentation/screens/sales/sales_screen.dart';
import '../../presentation/screens/sales/payment_screen.dart';
import '../../presentation/screens/products/products_screen.dart';
import '../../presentation/screens/products/product_form_screen.dart';
import '../../presentation/screens/transactions/transactions_screen.dart';
import '../../presentation/screens/transactions/transaction_detail_screen.dart';
import '../../presentation/screens/reports/reports_screen.dart';
import '../../presentation/screens/notifications/notifications_screen.dart';
import '../../presentation/screens/settings/settings_screen.dart';
import '../../presentation/screens/analytics/analytics_screen.dart';
import '../../presentation/screens/carwash/carwash_screen.dart';
import '../../presentation/screens/carwash/carwash_bookings_screen.dart';
import '../../presentation/screens/carwash/carwash_services_screen.dart';
import '../../presentation/screens/customers/customers_screen.dart';
import '../../presentation/screens/pre_orders/pre_orders_screen.dart';
import '../../presentation/widgets/common/app_scaffold.dart';
import '../../presentation/screens/agent/agent_home_screen.dart';
import '../../presentation/screens/admin/admin_home_screen.dart';
import '../../presentation/screens/audit_log/audit_log_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

/// Subtle fade+slide used on every route push.
Page<T> _fadeSlidePage<T>(Widget child, GoRouterState state) =>
    CustomTransitionPage<T>(
      key: state.pageKey,
      child: child,
      transitionDuration: const Duration(milliseconds: 280),
      reverseTransitionDuration: const Duration(milliseconds: 200),
      transitionsBuilder: (_, animation, __, child) => FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween(
            begin: const Offset(0, 0.035),
            end: Offset.zero,
          ).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOut)),
          child: child,
        ),
      ),
    );

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState      = ref.watch(authProvider);
  final agentState     = ref.watch(agentAuthProvider);
  final adminState     = ref.watch(adminAuthProvider);
  final needsBiometric = ref.watch(biometricGateProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    redirect: (context, state) {
      final user    = authState.valueOrNull;
      final agent   = agentState.valueOrNull;
      final admin   = adminState.valueOrNull;
      final isLoggedIn = user != null;
      final isLoading  = authState.isLoading;
      final loc = state.matchedLocation;

      // ── Admin routes ──────────────────────────────────────────────────
      if (loc.startsWith('/admin')) {
        if (adminState.isLoading) return null;
        return admin == null ? '/login?mode=admin' : null;
      }

      // ── Agent routes ──────────────────────────────────────────────────
      if (loc.startsWith('/agent')) {
        if (agentState.isLoading) return null;
        return agent == null ? '/login?mode=agent' : null;
      }

      // Legacy /agent-login deep-link redirect
      if (loc == '/agent-login') {
        return agent != null ? '/agent' : '/login?mode=agent';
      }

      // ── Redirect logged-in agent / admin away from splash & login ─────
      if (agentState.isLoading || adminState.isLoading) {
        return loc == '/' ? null : '/';
      }
      if (agent != null && (loc == '/' || loc == '/login')) return '/agent';
      if (admin != null && (loc == '/' || loc == '/login')) return '/admin';

      // ── Shop auth ─────────────────────────────────────────────────────
      if (isLoading) return loc == '/' ? null : '/';
      if (!isLoggedIn && loc != '/login') return '/login';
      if (isLoggedIn && needsBiometric && loc != '/biometric') {
        return '/biometric';
      }

      if (isLoggedIn && !needsBiometric) {
        final isLocked = user.readOnly && !user.inGracePeriod;
        const allowedWhenLocked = {'/billing', '/settings'};
        if (isLocked && !allowedWhenLocked.contains(loc)) return '/billing';

        if (loc == '/login' || loc == '/' || loc == '/biometric') {
          return user.isCarServiceShop ? '/carwash' : '/dashboard';
        }
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        pageBuilder: (_, s) => _fadeSlidePage(
          const Scaffold(body: Center(child: CircularProgressIndicator())),
          s,
        ),
      ),
      GoRoute(
        path: '/login',
        pageBuilder: (_, s) => _fadeSlidePage(const LoginScreen(), s),
      ),
      // Legacy path — redirected in guard above
      GoRoute(
        path: '/agent-login',
        redirect: (_, __) => '/login?mode=agent',
      ),
      GoRoute(
        path: '/agent',
        pageBuilder: (_, s) => _fadeSlidePage(const AgentHomeScreen(), s),
      ),
      GoRoute(
        path: '/admin',
        pageBuilder: (_, s) => _fadeSlidePage(const AdminHomeScreen(), s),
      ),
      GoRoute(
        path: '/biometric',
        pageBuilder: (_, s) => _fadeSlidePage(const BiometricScreen(), s),
      ),
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => AppScaffold(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            pageBuilder: (_, s) =>
                _fadeSlidePage(const DashboardScreen(), s),
          ),
          GoRoute(
            path: '/sales',
            pageBuilder: (_, s) => _fadeSlidePage(const SalesScreen(), s),
          ),
          GoRoute(
            path: '/transactions',
            pageBuilder: (_, s) =>
                _fadeSlidePage(const TransactionsScreen(), s),
          ),
          GoRoute(
            path: '/products',
            pageBuilder: (_, s) =>
                _fadeSlidePage(const ProductsScreen(), s),
          ),
          GoRoute(
            path: '/reports',
            pageBuilder: (_, s) =>
                _fadeSlidePage(const ReportsScreen(), s),
          ),
          GoRoute(
            path: '/customers',
            pageBuilder: (_, s) =>
                _fadeSlidePage(const CustomersScreen(), s),
          ),
          GoRoute(
            path: '/carwash',
            pageBuilder: (_, s) =>
                _fadeSlidePage(const CarwashScreen(), s),
          ),
          GoRoute(
            path: '/carwash/bookings',
            pageBuilder: (_, s) =>
                _fadeSlidePage(const CarwashBookingsScreen(), s),
          ),
          GoRoute(
            path: '/carwash/services',
            pageBuilder: (_, s) =>
                _fadeSlidePage(const CarwashServicesScreen(), s),
          ),
          GoRoute(
            path: '/analytics',
            pageBuilder: (_, s) =>
                _fadeSlidePage(const AnalyticsScreen(), s),
          ),
        ],
      ),
      GoRoute(
        path: '/billing',
        pageBuilder: (_, s) => _fadeSlidePage(const BillingScreen(), s),
      ),
      GoRoute(
        path: '/pre-orders',
        pageBuilder: (_, s) =>
            _fadeSlidePage(const PreOrdersScreen(), s),
      ),
      GoRoute(
        path: '/settings',
        pageBuilder: (_, s) =>
            _fadeSlidePage(const SettingsScreen(), s),
      ),
      GoRoute(
        path: '/products/add',
        pageBuilder: (_, s) =>
            _fadeSlidePage(const ProductFormScreen(), s),
      ),
      GoRoute(
        path: '/products/:id/edit',
        pageBuilder: (context, s) {
          final product = s.extra as ProductModel?;
          return _fadeSlidePage(ProductFormScreen(product: product), s);
        },
      ),
      GoRoute(
        path: '/transactions/:id',
        pageBuilder: (context, s) {
          final txn = s.extra as TransactionModel?;
          final id  = int.parse(s.pathParameters['id']!);
          return _fadeSlidePage(
              TransactionDetailScreen(transactionId: id, transaction: txn),
              s);
        },
      ),
      GoRoute(
        path: '/payment',
        pageBuilder: (_, s) =>
            _fadeSlidePage(const PaymentScreen(), s),
      ),
      GoRoute(
        path: '/notifications',
        pageBuilder: (_, s) =>
            _fadeSlidePage(const NotificationsScreen(), s),
      ),
      GoRoute(
        path: '/audit-log',
        pageBuilder: (_, s) =>
            _fadeSlidePage(const AuditLogScreen(), s),
      ),
    ],
  );
});
