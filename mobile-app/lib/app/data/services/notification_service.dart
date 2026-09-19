import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:get/get.dart';

class NotificationService extends GetxService {
  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();

  Future<NotificationService> init() async {
    const androidSettings = AndroidInitializationSettings('@drawable/ic_launcher_legacy');
    const initSettings = InitializationSettings(android: androidSettings);
    await _plugin.initialize(initSettings);
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
        'Nirmaldhara Notifications',
        channelDescription: 'Field force notifications',
        importance: Importance.high,
        priority: Priority.high,
      ),
    );
    await _plugin.show(id, title, body, details);
  }
}
