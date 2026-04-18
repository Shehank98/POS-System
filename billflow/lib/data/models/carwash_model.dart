import '../../core/utils/json_parse.dart';

class WashService {
  final int id;
  final String name;
  final String? description;
  final double price;
  final int? durationMinutes;
  final bool isActive;

  const WashService({
    required this.id,
    required this.name,
    this.description,
    required this.price,
    this.durationMinutes,
    required this.isActive,
  });

  factory WashService.fromJson(Map<String, dynamic> j) => WashService(
        id: toInt(j['id']),
        name: j['name'] as String? ?? '',
        description: j['description'] as String?,
        price: toDouble(j['price']),
        durationMinutes:
            j['duration_minutes'] != null ? toInt(j['duration_minutes']) : null,
        isActive: j['is_active'] as bool? ?? true,
      );
}

class CarwashJobItem {
  final int id;
  final String itemType; // 'service' | 'product'
  final String name;
  final double unitPrice;
  final int quantity;
  final double total;

  const CarwashJobItem({
    required this.id,
    required this.itemType,
    required this.name,
    required this.unitPrice,
    required this.quantity,
    required this.total,
  });

  factory CarwashJobItem.fromJson(Map<String, dynamic> j) => CarwashJobItem(
        id: toInt(j['id']),
        itemType: j['item_type'] as String? ?? 'service',
        name: j['name'] as String? ?? '',
        unitPrice: toDouble(j['unit_price']),
        quantity: toInt(j['quantity']),
        total: toDouble(j['total']),
      );
}

class CarwashJob {
  final int id;
  final String jobNumber;
  final String status; // pending | in_progress | completed | paid | cancelled
  final String? vehicleNumber;
  final String? vehicleType;
  final String? customerName;
  final String? customerPhone;
  final double totalAmount;
  final String? notes;
  final List<CarwashJobItem> items;
  final DateTime createdAt;

  const CarwashJob({
    required this.id,
    required this.jobNumber,
    required this.status,
    this.vehicleNumber,
    this.vehicleType,
    this.customerName,
    this.customerPhone,
    required this.totalAmount,
    this.notes,
    this.items = const [],
    required this.createdAt,
  });

  bool get isPending => status == 'pending';
  bool get isInProgress => status == 'in_progress';
  bool get isCompleted => status == 'completed';
  bool get isPaid => status == 'paid';

  factory CarwashJob.fromJson(Map<String, dynamic> j) => CarwashJob(
        id: toInt(j['id']),
        jobNumber: j['job_number'] as String? ?? '',
        status: j['status'] as String? ?? 'pending',
        vehicleNumber: j['vehicle_number'] as String?,
        vehicleType: j['vehicle_type'] as String?,
        customerName: j['customer_name'] as String?,
        customerPhone: j['customer_phone'] as String?,
        totalAmount: toDouble(j['total_amount']),
        notes: j['notes'] as String?,
        items: (j['items'] as List<dynamic>?)
                ?.map((e) => CarwashJobItem.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        createdAt: DateTime.tryParse(j['created_at'] as String? ?? '') ??
            DateTime.now(),
      );
}

class CarwashJobListResult {
  final List<CarwashJob> jobs;
  final int total;

  const CarwashJobListResult({required this.jobs, required this.total});

  factory CarwashJobListResult.fromJson(Map<String, dynamic> j) =>
      CarwashJobListResult(
        jobs: (j['jobs'] as List<dynamic>?)
                ?.map((e) => CarwashJob.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        total: toInt(j['total']),
      );
}

class CarwashBooking {
  final int id;
  final String? vehicleNumber;
  final String? phoneNumber;
  final String? customerName;
  final String? serviceName;
  final String? bookingDate;
  final String? timeSlot;
  final String? staffName;
  final String status; // booked | arrived | converted_to_job | cancelled
  final String? notes;
  final DateTime createdAt;

  const CarwashBooking({
    required this.id,
    this.vehicleNumber,
    this.phoneNumber,
    this.customerName,
    this.serviceName,
    this.bookingDate,
    this.timeSlot,
    this.staffName,
    required this.status,
    this.notes,
    required this.createdAt,
  });

  bool get isBooked => status == 'booked';
  bool get isArrived => status == 'arrived';
  bool get isConverted => status == 'converted_to_job';
  bool get isCancelled => status == 'cancelled';

  factory CarwashBooking.fromJson(Map<String, dynamic> j) => CarwashBooking(
        id: toInt(j['id']),
        vehicleNumber: j['vehicle_number'] as String?,
        phoneNumber: j['phone_number'] as String?,
        customerName: j['customer_name'] as String?,
        serviceName: j['service_name'] as String?,
        bookingDate: j['booking_date'] as String?,
        timeSlot: j['time_slot'] as String?,
        staffName: j['staff_name'] as String?,
        status: j['status'] as String? ?? 'booked',
        notes: j['notes'] as String?,
        createdAt: DateTime.tryParse(j['created_at'] as String? ?? '') ??
            DateTime.now(),
      );
}

class CarwashDashboard {
  final int todayJobs;
  final double todayRevenue;
  final int pendingJobs;
  final int inProgressJobs;
  final int completedJobs;

  const CarwashDashboard({
    required this.todayJobs,
    required this.todayRevenue,
    required this.pendingJobs,
    required this.inProgressJobs,
    required this.completedJobs,
  });

  factory CarwashDashboard.fromJson(Map<String, dynamic> j) => CarwashDashboard(
        todayJobs: toInt(j['today_jobs']),
        todayRevenue: toDouble(j['today_revenue']),
        pendingJobs: toInt(j['pending_jobs']),
        inProgressJobs: toInt(j['in_progress_jobs']),
        completedJobs: toInt(j['completed_jobs']),
      );

  factory CarwashDashboard.empty() => const CarwashDashboard(
        todayJobs: 0,
        todayRevenue: 0,
        pendingJobs: 0,
        inProgressJobs: 0,
        completedJobs: 0,
      );
}
