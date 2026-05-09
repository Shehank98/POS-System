import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
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

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  _LoginMode _mode = _LoginMode.shop;
  late final AnimationController _bgCtrl;
  late Animation<double> _bgAnim;

  @override
  void initState() {
    super.initState();
    _bgCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 500));
    _bgAnim = CurvedAnimation(parent: _bgCtrl, curve: Curves.easeInOut);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final m = Uri.base.queryParameters['mode'];
      if (m == 'agent') _switchMode(_LoginMode.agent);
      if (m == 'admin') _switchMode(_LoginMode.admin);
    });
  }

  @override
  void dispose() {
    _bgCtrl.dispose();
    super.dispose();
  }

  void _switchMode(_LoginMode mode) {
    if (_mode == mode) return;
    setState(() => _mode = mode);
    _bgCtrl.forward(from: 0);
  }

  List<Color> get _gradientTop => switch (_mode) {
        _LoginMode.shop  => [AppColors.navy, AppColors.navyMid],
        _LoginMode.agent => [const Color(0xFF064E3B), AppColors.agentGreenDark],
        _LoginMode.admin => [const Color(0xFF1E1B4B), const Color(0xFF3730A3)],
      };

  List<Color> get _gradientBottom => switch (_mode) {
        _LoginMode.shop  => [AppColors.navyMid, const Color(0xFF3B6CB7)],
        _LoginMode.agent => [AppColors.agentGreenDark, const Color(0xFF10B981)],
        _LoginMode.admin => [const Color(0xFF3730A3), const Color(0xFF6366F1)],
      };

  String get _wordmark => switch (_mode) {
        _LoginMode.shop  => 'BillFlow',
        _LoginMode.agent => 'BillFlow',
        _LoginMode.admin => 'BillFlow',
      };

  String get _tagline => switch (_mode) {
        _LoginMode.shop  => 'Point of Sale System',
        _LoginMode.agent => 'Agent Network',
        _LoginMode.admin => 'Administration',
      };

  IconData get _modeIcon => switch (_mode) {
        _LoginMode.shop  => Icons.point_of_sale_rounded,
        _LoginMode.agent => Icons.badge_rounded,
        _LoginMode.admin => Icons.admin_panel_settings_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: AnimatedContainer(
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [..._gradientTop, ..._gradientBottom],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            stops: const [0.0, 0.35, 0.65, 1.0],
          ),
        ),
        child: Stack(children: [
          // Decorative circles
          Positioned(
            top: -size.width * 0.3,
            right: -size.width * 0.2,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 600),
              width: size.width * 0.7,
              height: size.width * 0.7,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.06),
              ),
            ),
          ),
          Positioned(
            bottom: size.height * 0.3,
            left: -size.width * 0.25,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 600),
              width: size.width * 0.5,
              height: size.width * 0.5,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.05),
              ),
            ),
          ),

          // Content
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: size.height - 80),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 40),

                    // Logo / wordmark
                    _Wordmark(
                      wordmark: _wordmark,
                      tagline: _tagline,
                      icon: _modeIcon,
                      mode: _mode,
                    )
                        .animate()
                        .fadeIn(duration: 400.ms)
                        .slideY(begin: -0.08, end: 0, duration: 400.ms),

                    const SizedBox(height: 32),

                    // Mode selector
                    _ModeSelector(mode: _mode, onChanged: _switchMode)
                        .animate()
                        .fadeIn(duration: 350.ms, delay: 80.ms),

                    const SizedBox(height: 24),

                    // Frosted glass form card
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      transitionBuilder: (child, anim) => FadeTransition(
                        opacity: anim,
                        child: SlideTransition(
                          position: Tween(
                                  begin: const Offset(0, 0.06),
                                  end: Offset.zero)
                              .animate(CurvedAnimation(
                                  parent: anim, curve: Curves.easeOut)),
                          child: child,
                        ),
                      ),
                      child: switch (_mode) {
                        _LoginMode.shop  => _ShopLoginForm(key: const ValueKey('shop')),
                        _LoginMode.agent => _AgentLoginForm(key: const ValueKey('agent')),
                        _LoginMode.admin => _AdminLoginForm(key: const ValueKey('admin')),
                      },
                    )
                        .animate()
                        .fadeIn(duration: 350.ms, delay: 120.ms),

                    const SizedBox(height: 24),
                    Text(
                      'BillFlow © 2026',
                      style: GoogleFonts.inter(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.35)),
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Logo / wordmark ───────────────────────────────────────────────────────────
class _Wordmark extends StatelessWidget {
  final String wordmark;
  final String tagline;
  final IconData icon;
  final _LoginMode mode;

  const _Wordmark({
    required this.wordmark,
    required this.tagline,
    required this.icon,
    required this.mode,
  });

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: Container(
          key: ValueKey(mode),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
                color: Colors.white.withValues(alpha: 0.2), width: 1),
          ),
          child: Icon(icon, size: 48, color: Colors.white),
        ),
      ),
      const SizedBox(height: 14),
      Text(
        wordmark,
        style: GoogleFonts.poppins(
          fontSize: 34,
          fontWeight: FontWeight.w800,
          color: Colors.white,
          letterSpacing: -0.5,
          height: 1,
        ),
      ),
      const SizedBox(height: 4),
      AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        child: Text(
          tagline,
          key: ValueKey(tagline),
          style: GoogleFonts.inter(
            fontSize: 13,
            color: Colors.white.withValues(alpha: 0.72),
            letterSpacing: 0.5,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    ]);
  }
}

// ── Mode selector ─────────────────────────────────────────────────────────────
class _ModeSelector extends StatelessWidget {
  final _LoginMode mode;
  final void Function(_LoginMode) onChanged;

  const _ModeSelector({required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(32),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(32),
            border: Border.all(
                color: Colors.white.withValues(alpha: 0.2), width: 1),
          ),
          padding: const EdgeInsets.all(4),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            _ModeTab(
              label: 'Shop',
              icon: Icons.store_outlined,
              selected: mode == _LoginMode.shop,
              onTap: () => onChanged(_LoginMode.shop),
            ),
            _ModeTab(
              label: 'Agent',
              icon: Icons.badge_outlined,
              selected: mode == _LoginMode.agent,
              onTap: () => onChanged(_LoginMode.agent),
            ),
            _ModeTab(
              label: 'Admin',
              icon: Icons.shield_outlined,
              selected: mode == _LoginMode.admin,
              onTap: () => onChanged(_LoginMode.admin),
            ),
          ]),
        ),
      ),
    );
  }
}

class _ModeTab extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _ModeTab({
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
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(28),
          boxShadow: selected
              ? [
                  BoxShadow(
                      color: Colors.black.withValues(alpha: 0.10),
                      blurRadius: 8,
                      offset: const Offset(0, 2))
                ]
              : [],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon,
              size: 15,
              color: selected ? AppColors.textPrimary : Colors.white70),
          const SizedBox(width: 5),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
              color: selected ? AppColors.textPrimary : Colors.white70,
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Frosted glass form card ───────────────────────────────────────────────────
class _GlassCard extends StatelessWidget {
  final Widget child;
  const _GlassCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
                color: Colors.white.withValues(alpha: 0.6), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 32,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          padding: const EdgeInsets.all(24),
          child: child,
        ),
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
          SnackBar(content: Text(msg), backgroundColor: AppColors.danger));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authProvider).isLoading || _loadingCreds;
    return _GlassCard(
      child: _LoginForm(
        title: 'Shop Sign In',
        subtitle: 'Sign in with your email or username',
        formKey: _formKey,
        gradient: const [AppColors.navy, AppColors.navyMid],
        isLoading: isLoading,
        onSubmit: _submit,
        fields: [
          _LoginField(
            controller: _identifierCtrl,
            label: 'Email or Username',
            icon: Icons.person_outline_rounded,
            keyboardType: TextInputType.emailAddress,
            action: TextInputAction.next,
            validator: (v) =>
                (v == null || v.isEmpty) ? 'Enter your email or username' : null,
          ),
          _LoginField(
            controller: _passwordCtrl,
            label: 'Password',
            icon: Icons.lock_outline_rounded,
            obscure: _obscure,
            onToggleObscure: () => setState(() => _obscure = !_obscure),
            action: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            validator: (v) =>
                (v == null || v.isEmpty) ? 'Enter password' : null,
          ),
        ],
      ),
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
  final _formKey      = GlobalKey<FormState>();
  final _emailCtrl    = TextEditingController();
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
          SnackBar(content: Text(msg), backgroundColor: AppColors.danger));
      return;
    }
    if (ref.read(agentAuthProvider).valueOrNull != null && mounted) {
      context.go('/agent');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(agentAuthProvider).isLoading;
    return _GlassCard(
      child: _LoginForm(
        title: 'Agent Sign In',
        subtitle: 'Use your agent email and password',
        formKey: _formKey,
        gradient: const [Color(0xFF064E3B), AppColors.agentGreen],
        isLoading: isLoading,
        onSubmit: _submit,
        fields: [
          _LoginField(
            controller: _emailCtrl,
            label: 'Email',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            action: TextInputAction.next,
            validator: (v) =>
                (v == null || v.isEmpty) ? 'Enter email' : null,
          ),
          _LoginField(
            controller: _passwordCtrl,
            label: 'Password',
            icon: Icons.lock_outline_rounded,
            obscure: _obscure,
            onToggleObscure: () => setState(() => _obscure = !_obscure),
            action: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            validator: (v) =>
                (v == null || v.isEmpty) ? 'Enter password' : null,
          ),
        ],
      ),
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
  final _formKey      = GlobalKey<FormState>();
  final _emailCtrl    = TextEditingController();
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
          SnackBar(content: Text(msg), backgroundColor: AppColors.danger));
    }
    if (ref.read(adminAuthProvider).valueOrNull != null && mounted) {
      context.go('/admin');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(adminAuthProvider).isLoading;
    return _GlassCard(
      child: _LoginForm(
        title: 'Admin Sign In',
        subtitle: 'System administrator access',
        formKey: _formKey,
        gradient: const [Color(0xFF1E1B4B), Color(0xFF4338CA)],
        isLoading: isLoading,
        onSubmit: _submit,
        fields: [
          _LoginField(
            controller: _emailCtrl,
            label: 'Admin Email',
            icon: Icons.shield_outlined,
            keyboardType: TextInputType.emailAddress,
            action: TextInputAction.next,
            validator: (v) =>
                (v == null || v.isEmpty) ? 'Enter email' : null,
          ),
          _LoginField(
            controller: _passwordCtrl,
            label: 'Password',
            icon: Icons.lock_outline_rounded,
            obscure: _obscure,
            onToggleObscure: () => setState(() => _obscure = !_obscure),
            action: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            validator: (v) =>
                (v == null || v.isEmpty) ? 'Enter password' : null,
          ),
        ],
      ),
    );
  }
}

// ── Shared login form internals ───────────────────────────────────────────────
class _LoginForm extends StatelessWidget {
  final String title;
  final String subtitle;
  final GlobalKey<FormState> formKey;
  final List<Widget> fields;
  final bool isLoading;
  final VoidCallback onSubmit;
  final List<Color> gradient;

  const _LoginForm({
    required this.title,
    required this.subtitle,
    required this.formKey,
    required this.fields,
    required this.isLoading,
    required this.onSubmit,
    required this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(
          title,
          style: GoogleFonts.poppins(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          subtitle,
          style: GoogleFonts.inter(
            fontSize: 13,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 20),
        ...fields.expand((f) => [f, const SizedBox(height: 12)]).toList()
          ..removeLast(),
        const SizedBox(height: 22),
        _GradientButton(
          label: 'Sign In',
          gradient: gradient,
          isLoading: isLoading,
          onPressed: onSubmit,
        ),
      ]),
    );
  }
}

class _LoginField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType keyboardType;
  final TextInputAction action;
  final bool obscure;
  final VoidCallback? onToggleObscure;
  final ValueChanged<String>? onSubmitted;
  final FormFieldValidator<String>? validator;

  const _LoginField({
    required this.controller,
    required this.label,
    required this.icon,
    this.keyboardType = TextInputType.text,
    this.action = TextInputAction.next,
    this.obscure = false,
    this.onToggleObscure,
    this.onSubmitted,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: action,
      obscureText: obscure,
      autocorrect: false,
      onFieldSubmitted: onSubmitted,
      validator: validator,
      style: GoogleFonts.inter(
          fontSize: 14,
          color: AppColors.textPrimary,
          fontWeight: FontWeight.w500),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 18),
        suffixIcon: onToggleObscure != null
            ? IconButton(
                icon: Icon(
                  obscure
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 18,
                ),
                onPressed: onToggleObscure,
              )
            : null,
        filled: true,
        fillColor: AppColors.surfaceLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.navy, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        isDense: true,
      ),
    );
  }
}

class _GradientButton extends StatelessWidget {
  final String label;
  final List<Color> gradient;
  final bool isLoading;
  final VoidCallback onPressed;

  const _GradientButton({
    required this.label,
    required this.gradient,
    required this.isLoading,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isLoading
              ? [Colors.grey.shade400, Colors.grey.shade300]
              : gradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: isLoading
            ? []
            : [
                BoxShadow(
                  color: gradient.first.withValues(alpha: 0.4),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isLoading ? null : onPressed,
          borderRadius: BorderRadius.circular(14),
          child: Center(
            child: isLoading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.5, color: Colors.white),
                  )
                : Text(
                    label,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      letterSpacing: 0.3,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
