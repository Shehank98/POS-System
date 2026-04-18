import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Top-level background handler — runs in a separate Dart isolate.
// Must call Firebase.initializeApp() first and initialize local notifications
// independently (static state is not shared across isolates).
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();

  final notification = message.notification;
  if (notification == null) return;

  final plugin = FlutterLocalNotificationsPlugin();
  await plugin.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    ),
  );
  await plugin.show(
    notification.hashCode,
    notification.title,
    notification.body,
    const NotificationDetails(
      android: AndroidNotificationDetails(
        'billflow_high',
        'BillFlow Alerts',
        channelDescription: 'Pre-order and stock alerts',
        importance: Importance.high,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
      ),
    ),
  );
}

class PushNotificationService {
  static final _messaging = FirebaseMessaging.instance;
  static final _localNotifications = FlutterLocalNotificationsPlugin();

  static const _androidChannel = AndroidNotificationChannel(
    'billflow_high',
    'BillFlow Alerts',
    description: 'Pre-order and stock alerts',
    importance: Importance.high,
  );

  static Future<void> initialize() async {
    // Register background handler before anything else
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_androidChannel);

    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
    );

    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Foreground messages — show via local notifications
    FirebaseMessaging.onMessage.listen(showLocalNotification);

    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
  }

  static Future<void> showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    await _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'billflow_high',
          'BillFlow Alerts',
          channelDescription: 'Pre-order and stock alerts',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
      ),
    );
  }

  static Future<String?> getToken() async {
    return _messaging.getToken();
  }

  static void subscribeToTopic(String topic) {
    _messaging.subscribeToTopic(topic);
  }
}

final pushNotificationServiceProvider =
    Provider<PushNotificationService>((_) => PushNotificationService());
