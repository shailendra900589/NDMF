import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:get/get.dart';

class NotificationService extends GetxService {
  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();

  Future<NotificationService> init() async {
    try {
      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const initSettings = InitializationSettings(android: androidSettings);
      await _plugin.initialize(initSettings);
      await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission();
    } catch (_) {
      // Never block app open if notification channel fails.
    }
    return this;
  }

  Future<void> showNotification({
    required int id,
    required String title,
    required String body,
  }) async {
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'nirmaldhara_channel',
        'MyStaff Smart notifications',
        channelDescription: 'Field force notifications',
        importance: Importance.high,
        priority: Priority.high,
      ),
    );
    await _plugin.show(id, title, body, details);
  }
}
