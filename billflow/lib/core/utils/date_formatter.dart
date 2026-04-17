import 'package:intl/intl.dart';

String formatDate(DateTime dt) => DateFormat('d MMM yyyy').format(dt);

String formatTime(DateTime dt) => DateFormat('HH:mm').format(dt);

String formatDateTime(DateTime dt) => DateFormat('d MMM yyyy, HH:mm').format(dt);

String toApiDate(DateTime dt) => DateFormat('yyyy-MM-dd').format(dt);

String relativeTime(DateTime dt) {
  final diff = DateTime.now().difference(dt);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return formatDate(dt);
}
