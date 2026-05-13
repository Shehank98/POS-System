import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
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
        SnackBar(
          content: Text(msg,
              style: GoogleFonts.manrope(fontSize: 13, fontWeight: FontWeight.w500)),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authProvider).isLoading || _loadingCreds;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: MediaQuery.of(context).size.height -
                  MediaQuery.of(context).padding.top -
                  MediaQuery.of(context).padding.bottom,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 36),

                // Brand mark
                Row(children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: AppColors.ink,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'B',
                      style: GoogleFonts.manrope(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'BillFlow',
                    style: GoogleFonts.manrope(
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink,
                      letterSpacing: -0.2,
                    ),
                  ),
                ]),

                const SizedBox(height: 56),

                // Header
                _EyebrowLabel(
                  text: 'Good morning',
                  color: AppColors.brand,
                ),
                const SizedBox(height: 12),
                Text(
                  'Open the\nregister.',
                  style: GoogleFonts.manrope(
                    fontSize: 34,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                    letterSpacing: -0.8,
                    height: 1.08,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Sign in to start the day.',
                  style: GoogleFonts.manrope(
                    fontSize: 15,
                    color: AppColors.ink2,
                    height: 1.4,
                  ),
                ),

                const SizedBox(height: 36),

                // Fields
                Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _UnderlineField(
                        label: 'Email or Username',
                        controller: _identifierCtrl,
                        keyboardType: TextInputType.emailAddress,
                        action: TextInputAction.next,
                        validator: (v) =>
                            (v == null || v.isEmpty)
                                ? 'Enter your email or username'
                                : null,
                      ),
                      const SizedBox(height: 18),
                      _UnderlineField(
                        label: 'Passcode',
                        controller: _passwordCtrl,
                        obscure: _obscure,
                        action: TextInputAction.done,
                        onSubmitted: (_) => _submit(),
                        validator: (v) =>
                            (v == null || v.isEmpty) ? 'Enter passcode' : null,
                        trailing: GestureDetector(
                          onTap: () => setState(() => _obscure = !_obscure),
                          child: Icon(
                            _obscure
                                ? Icons.lock_outline_rounded
                                : Icons.lock_open_outlined,
                            size: 16,
                            color: AppColors.ink3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 48),

                // Sign in button
                GestureDetector(
                  onTap: isLoading ? null : _submit,
                  child: Container(
                    width: double.infinity,
                    height: 56,
                    decoration: BoxDecoration(
                      color: isLoading ? AppColors.ink2 : AppColors.ink,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (isLoading)
                          const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: Colors.white,
                            ),
                          )
                        else ...[
                          Text(
                            'Open today',
                            style: GoogleFonts.manrope(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                              letterSpacing: -0.1,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.chevron_right,
                              color: Colors.white, size: 18),
                        ],
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 20),

                // Footer
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'v2.4 · Online',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 12,
                        color: AppColors.ink3,
                      ),
                    ),
                    Text(
                      'BillFlow © 2026',
                      style: GoogleFonts.manrope(
                        fontSize: 12,
                        color: AppColors.ink3,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Eyebrow label ─────────────────────────────────────────────────────────────
class _EyebrowLabel extends StatelessWidget {
  final String text;
  final Color? color;
  const _EyebrowLabel({required this.text, this.color});

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: GoogleFonts.manrope(
        fontSize: 10.5,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.12,
        color: color ?? AppColors.ink3,
      ),
    );
  }
}

// ── Underline field ───────────────────────────────────────────────────────────
class _UnderlineField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool obscure;
  final TextInputType keyboardType;
  final TextInputAction action;
  final ValueChanged<String>? onSubmitted;
  final FormFieldValidator<String>? validator;
  final Widget? trailing;

  const _UnderlineField({
    required this.label,
    required this.controller,
    this.obscure = false,
    this.keyboardType = TextInputType.text,
    this.action = TextInputAction.next,
    this.onSubmitted,
    this.validator,
    this.trailing,
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
      style: GoogleFonts.manrope(
        fontSize: 18,
        fontWeight: FontWeight.w500,
        color: AppColors.ink,
      ),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: GoogleFonts.manrope(
          fontSize: 10.5,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.12,
          color: AppColors.ink3,
        ),
        floatingLabelBehavior: FloatingLabelBehavior.always,
        suffixIcon: trailing != null
            ? Padding(
                padding: const EdgeInsets.only(right: 4),
                child: trailing,
              )
            : null,
        suffixIconConstraints: const BoxConstraints(minWidth: 32, minHeight: 32),
        filled: false,
        border: UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.hairline),
        ),
        enabledBorder: UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.hairline),
        ),
        focusedBorder: UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.ink, width: 1.5),
        ),
        errorBorder: UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.danger, width: 1.5),
        ),
        contentPadding: const EdgeInsets.only(bottom: 10),
        isDense: true,
      ),
    );
  }
}
