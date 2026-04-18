import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../providers/carwash_provider.dart';
import '../../../data/models/carwash_model.dart';

class CarwashBookingsScreen extends ConsumerWidget {
  const CarwashBookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookingsAsync = ref.watch(carwashBookingsProvider);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pre-Bookings'),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(carwashBookingsProvider),
          ),
        ],
      ),
      body: bookingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_outlined, size: 40, color: Colors.grey),
              const SizedBox(height: 8),
              Text(e.toString(),
                  style: const TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(carwashBookingsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (bookings) {
          if (bookings.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.calendar_today_outlined,
                      size: 48, color: cs.onSurfaceVariant),
                  const SizedBox(height: 8),
                  Text('No pre-bookings',
                      style: TextStyle(color: cs.onSurfaceVariant)),
                  const SizedBox(height: 4),
                  Text('Bookings made by customers will appear here.',
                      style: TextStyle(
                          fontSize: 12, color: cs.onSurfaceVariant),
                      textAlign: TextAlign.center),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(carwashBookingsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: bookings.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (ctx, i) => _BookingCard(booking: bookings[i]),
            ),
          );
        },
      ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  final CarwashBooking booking;
  const _BookingCard({required this.booking});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final (label, color) = _statusInfo(booking.status);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: cs.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    label,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: color),
                  ),
                ),
                const Spacer(),
                if (booking.bookingDate != null)
                  Text(
                    _formatDate(booking.bookingDate!),
                    style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.directions_car, size: 18),
                const SizedBox(width: 6),
                Text(
                  booking.vehicleNumber ?? '—',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15),
                ),
                if (booking.timeSlot != null) ...[
                  const Spacer(),
                  Text(booking.timeSlot!,
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: cs.primary,
                          fontSize: 14)),
                ],
              ],
            ),
            if (booking.customerName != null || booking.phoneNumber != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.person_outline,
                      size: 14, color: cs.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(
                    booking.customerName ?? booking.phoneNumber ?? '',
                    style: TextStyle(
                        fontSize: 12, color: cs.onSurfaceVariant),
                  ),
                ],
              ),
            ],
            if (booking.serviceName != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.build_outlined,
                      size: 14, color: cs.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(booking.serviceName!,
                      style: TextStyle(
                          fontSize: 12, color: cs.onSurfaceVariant)),
                ],
              ),
            ],
            if (booking.staffName != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.badge_outlined,
                      size: 14, color: cs.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text('Assigned: ${booking.staffName}',
                      style: TextStyle(
                          fontSize: 12, color: cs.onSurfaceVariant)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  (String, Color) _statusInfo(String s) => switch (s) {
        'arrived' => ('Arrived', Colors.orange),
        'converted_to_job' => ('Converted', Colors.green),
        'cancelled' => ('Cancelled', Colors.grey),
        _ => ('Booked', Colors.blue),
      };

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${months[d.month - 1]} ${d.day}';
    } catch (_) {
      return dateStr;
    }
  }
}
