import 'package:intl/intl.dart';

String formatCurrency(double amount, {String symbol = 'RM'}) {
  final formatter = NumberFormat.currency(
    symbol: '$symbol ',
    decimalDigits: 2,
  );
  return formatter.format(amount);
}

String formatNumber(double amount) {
  final formatter = NumberFormat('#,##0.##');
  return formatter.format(amount);
}
