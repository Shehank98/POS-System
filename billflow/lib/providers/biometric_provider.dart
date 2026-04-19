import 'package:flutter_riverpod/flutter_riverpod.dart';

// true = user auto-logged in but still needs biometric confirmation
final biometricGateProvider = StateProvider<bool>((ref) => false);
