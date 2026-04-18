import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/feature_flag_provider.dart';
import 'providers/theme_provider.dart';

class BillFlowApp extends ConsumerWidget {
  const BillFlowApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final themeMode = ref.watch(themeModeProvider);

    // Start periodic feature-flag refresh whenever a user is logged in
    final isLoggedIn = ref.watch(authProvider).valueOrNull != null;
    if (isLoggedIn) ref.watch(featureFlagRefresherProvider);

    return MaterialApp.router(
      title: 'BillFlow',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
