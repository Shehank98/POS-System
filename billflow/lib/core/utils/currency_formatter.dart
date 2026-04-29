import 'package:intl/intl.dart';

String formatCurrency(double amount, {String symbol = 'Rs.'}) {
  final formatter = NumberFormat.currency(
    locale: 'en_US',
    symbol: '$symbol ',
    decimalDigits: 2,
  );
  return formatter.format(amount);
}

String formatNumber(double amount) {
  final formatter = NumberFormat('#,##0.##');
  return formatter.format(amount);
}
