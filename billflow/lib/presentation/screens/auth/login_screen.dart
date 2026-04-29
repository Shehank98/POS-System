import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/agent_auth_provider.dart';
import '../../../providers/admin_auth_provider.dart';

enum _LoginMode { shop, agent, admin }

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  _LoginMode _mode = _LoginMode.shop;

  @override
  void initState() {
    super.initState();
    // Pre-select mode from query param (?mode=agent or ?mode=admin)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final uri = Uri.base;
      final m = uri.queryParameters['mode'];
      if (m == 'agent') setState(() => _mode = _LoginMode.agent);
      if (m == 'admin') setState(() => _mode = _LoginMode.admin);
    });
  }

  void _switchMode(_LoginMode mode) {
    if (_mode == mode) return;
    setState(() => _mode = mode);
  }

  // Gradient colors per mode
  List<Color> get _gradientColors => switch (_mode) {
        _LoginMode.shop  => [AppColors.primary, AppColors.primaryLight],
        _LoginMode.agent => [const Color(0xFF1B5E20), const Color(0xFF388E3C)],
        _LoginMode.admin => [const Color(0xFF1A237E), const Color(0xFF303F9F)],
      };

  IconData get _modeIcon => switch (_mode) {
        _LoginMode.shop  => Icons.point_of_sale,
        _LoginMode.agent => Icons.badge_outlined,
        _LoginMode.admin => Icons.admin_panel_settings_outlined,
      };

  String get _modeTitle => switch (_mode) {
        _LoginMode.shop  => 'BillFlow',
        _LoginMode.agent => 'Agent Portal',
        _LoginMode.admin => 'Admin Portal',
      };

  String get _modeSubtitle => switch (_mode) {
        _LoginMode.shop  => 'Point of Sale System',
        _LoginMode.agent => 'BillFlow Agent Network',
        _LoginMode.admin => 'System Administration',
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedContainer(
        duration: const Duration(milliseconds: 400),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: _gradientColors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                // Mode selector chips
                _ModeSelector(mode: _mode, onChanged: _switchMode)
                    .animate()
                    .fadeIn(duration: 300.ms),

                const SizedBox(height: 20),

                // Icon + title
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: Column(
                    key: ValueKey(_mode),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: Icon(_modeIcon, size: 56, color: Colors.white),
                      ),
                      const SizedBox(height: 16),
                      Text(_modeTitle,
                          style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 1.2)),
                      Text(_modeSubtitle,
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 14)),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(duration: 400.ms)
                    .slideY(begin: -0.1, end: 0, duration: 400.ms),

                const SizedBox(height: 32),

                // Form card
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  transitionBuilder: (child, anim) => FadeTransition(
                    opacity: anim,
                    child: SlideTransition(
                      position: Tween(
                              begin: const Offset(0, 0.04),
                              end: Offset.zero)
                          .animate(anim),
                      child: child,
                    ),
                  ),
                  child: switch (_mode) {
                    _LoginMode.shop  => _ShopLoginForm(key: const ValueKey('shop')),
                    _LoginMode.agent => _AgentLoginForm(key: const ValueKey('agent')),
                    _LoginMode.admin => _AdminLoginForm(key: const ValueKey('admin')),
                  },
                ),

                const SizedBox(height: 12),
                const Text('BillFlow © 2026',
                    style: TextStyle(color: Colors.white38, fontSize: 12)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Mode selector ─────────────────────────────────────────────────────────────

class _ModeSelector extends StatelessWidget {
  final _LoginMode mode;
  final void Function(_LoginMode) onChanged;

  const _ModeSelector({required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(32),
      ),
      padding: const EdgeInsets.all(4),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        _ModeChip(
          label: 'Shop',
          icon: Icons.store_outlined,
          selected: mode == _LoginMode.shop,
          onTap: () => onChanged(_LoginMode.shop),
        ),
        _ModeChip(
          label: 'Agent',
          icon: Icons.badge_outlined,
          selected: mode == _LoginMode.agent,
          onTap: () => onChanged(_LoginMode.agent),
        ),
        _ModeChip(
          label: 'Admin',
          icon: Icons.admin_panel_settings_outlined,
          selected: mode == _LoginMode.admin,
          onTap: () => onChanged(_LoginMode.admin),
        ),
      ]),
    );
  }
}

class _ModeChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _ModeChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(28),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon,
              size: 16,
              color: selected ? Colors.black87 : Colors.white70),
          const SizedBox(width: 6),
          Text(label,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight:
                      selected ? FontWeight.bold : FontWeight.normal,
                  color: selected ? Colors.black87 : Colors.white70)),
        ]),
      ),
    );
  }
}

// ── Shop login form ───────────────────────────────────────────────────────────

class _ShopLoginForm extends ConsumerStatefulWidget {
  const _ShopLoginForm({super.key});

  @override
  ConsumerState<_ShopLoginForm> createState() => _ShopLoginFormState();
}

class _ShopLoginFormState extends ConsumerState<_ShopLoginForm> {
  final _formKey        = GlobalKey<FormState>();
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl   = TextEditingController();
  bool _obscure      = true;
  bool _loadingCreds = true;

  @override
  void initState() {
    super.initState();
    _loadSaved();
  }

  Future<void> _loadSaved() async {
    final saved = await SecureStorage().readLastLogin();
    if (mounted) {
      _identifierCtrl.text = saved['identifier'] ?? '';
      setState(() => _loadingCreds = false);
    }
  }

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(authProvider.notifier).login(
          _identifierCtrl.text.trim(),
          _passwordCtrl.text,
        );
    final error = ref.read(authProvider).error;
    if (error != null && mounted) {
      final msg = error is ApiException ? error.message : 'Login failed';
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: Colors.red));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authProvider).isLoading || _loadingCreds;
    return _FormCard(
      title: 'Shop Sign In',
      subtitle: 'Sign in with your email or username',
      formKey: _formKey,
      fields: [
        TextFormField(
          controller: _identifierCtrl,
          decoration: const InputDecoration(
            labelText: 'Email or Username',
            prefixIcon: Icon(Icons.person_outline),
            helperText: 'Use your email or account username',
          ),
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autocorrect: false,
          validator: (v) =>
              (v == null || v.isEmpty) ? 'Enter your email or username' : null,
        ),
        TextFormField(
          controller: _passwordCtrl,
          decoration: InputDecoration(
            labelText: 'Password',
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(_obscure
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
          ),
          obscureText: _obscure,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _submit(),
          validator: (v) =>
              (v == null || v.isEmpty) ? 'Enter password' : null,
        ),
      ],
      isLoading: isLoading,
      onSubmit: _submit,
      buttonColor: AppColors.primary,
    );
  }
}

// ── Agent login form ──────────────────────────────────────────────────────────

class _AgentLoginForm extends ConsumerStatefulWidget {
  const _AgentLoginForm({super.key});

  @override
  ConsumerState<_AgentLoginForm> createState() => _AgentLoginFormState();
}

class _AgentLoginFormState extends ConsumerState<_AgentLoginForm> {
  final _formKey     = GlobalKey<FormState>();
  final _emailCtrl   = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(agentAuthProvider.notifier).login(
          _emailCtrl.text.trim(),
          _passwordCtrl.text,
        );
    final error = ref.read(agentAuthProvider).error;
    if (error != null && mounted) {
      final msg = error is ApiException ? error.message : 'Login failed';
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: Colors.red));
      return;
    }
    if (ref.read(agentAuthProvider).valueOrNull != null && mounted) {
      context.go('/agent');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(agentAuthProvider).isLoading;
    return _FormCard(
      title: 'Agent Sign In',
      subtitle: 'Use your agent email and password',
      formKey: _formKey,
      fields: [
        TextFormField(
          controller: _emailCtrl,
          decoration: const InputDecoration(
            labelText: 'Email',
            prefixIcon: Icon(Icons.email_outlined),
          ),
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          validator: (v) => (v == null || v.isEmpty) ? 'Enter email' : null,
        ),
        TextFormField(
          controller: _passwordCtrl,
          decoration: InputDecoration(
            labelText: 'Password',
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(_obscure
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
          ),
          obscureText: _obscure,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _submit(),
          validator: (v) =>
              (v == null || v.isEmpty) ? 'Enter password' : null,
        ),
      ],
      isLoading: isLoading,
      onSubmit: _submit,
      buttonColor: const Color(0xFF2E7D32),
    );
  }
}

// ── Admin login form ──────────────────────────────────────────────────────────

class _AdminLoginForm extends ConsumerStatefulWidget {
  const _AdminLoginForm({super.key});

  @override
  ConsumerState<_AdminLoginForm> createState() => _AdminLoginFormState();
}

class _AdminLoginFormState extends ConsumerState<_AdminLoginForm> {
  final _formKey     = GlobalKey<FormState>();
  final _emailCtrl   = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(adminAuthProvider.notifier).login(
          _emailCtrl.text.trim(),
          _passwordCtrl.text,
        );
    final error = ref.read(adminAuthProvider).error;
    if (error != null && mounted) {
      final msg = error is ApiException ? error.message : 'Login failed';
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: Colors.red));
    }
    if (ref.read(adminAuthProvider).valueOrNull != null && mounted) {
      context.go('/admin');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(adminAuthProvider).isLoading;
    return _FormCard(
      title: 'Admin Sign In',
      subtitle: 'System administrator access',
      formKey: _formKey,
      fields: [
        TextFormField(
          controller: _emailCtrl,
          decoration: const InputDecoration(
            labelText: 'Admin Email',
            prefixIcon: Icon(Icons.admin_panel_settings_outlined),
          ),
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          validator: (v) => (v == null || v.isEmpty) ? 'Enter email' : null,
        ),
        TextFormField(
          controller: _passwordCtrl,
          decoration: InputDecoration(
            labelText: 'Password',
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(_obscure
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
          ),
          obscureText: _obscure,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _submit(),
          validator: (v) =>
              (v == null || v.isEmpty) ? 'Enter password' : null,
        ),
      ],
      isLoading: isLoading,
      onSubmit: _submit,
      buttonColor: const Color(0xFF283593),
    );
  }
}

// ── Shared form card ──────────────────────────────────────────────────────────

class _FormCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final GlobalKey<FormState> formKey;
  final List<Widget> fields;
  final bool isLoading;
  final VoidCallback onSubmit;
  final Color buttonColor;

  const _FormCard({
    required this.title,
    required this.subtitle,
    required this.formKey,
    required this.fields,
    required this.isLoading,
    required this.onSubmit,
    required this.buttonColor,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(subtitle,
                  style: TextStyle(
                      fontSize: 13, color: Colors.grey[600])),
              const SizedBox(height: 20),
              ...fields
                  .expand((f) => [f, const SizedBox(height: 14)])
                  .toList()
                ..removeLast(),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: isLoading ? null : onSubmit,
                style: FilledButton.styleFrom(
                  backgroundColor: buttonColor,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Sign In',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
