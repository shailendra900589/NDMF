import 'package:get/get.dart';
import '../data/services/storage_service.dart';
import '../data/services/api_service.dart';
import '../data/services/connectivity_service.dart';
import '../data/services/location_service.dart';
import '../data/services/camera_service.dart';
import '../data/services/tracking_service.dart';
import '../data/services/dummy_api_service.dart';
import '../data/services/remote_api_service.dart';
import '../data/services/ndfa_api_service.dart';
import '../data/services/sync_service.dart';
import '../data/services/notification_service.dart';
import '../data/services/image_watermark_service.dart';
import '../data/services/security_platform_service.dart';
import '../data/services/maps_navigation_service.dart';
import '../data/services/voice_recording_service.dart';
import '../data/services/upload_service.dart';
import '../data/services/call_service.dart';
import '../data/services/data_refresh_service.dart';

/// Fast cold start: only storage/connectivity/API before first frame.
/// Network sync & notifications run after UI is visible.
class AppInitializer {
  AppInitializer._();

  static bool _deferredStarted = false;

  /// Must finish before [runApp] — keep this under ~200ms.
  static Future<void> initCritical() async {
    if (Get.isRegistered<StorageService>()) return;

    await Get.putAsync<StorageService>(() => StorageService().init(), permanent: true);
    await Get.putAsync<ConnectivityService>(() => ConnectivityService().init(), permanent: true);

    Get.put<LocationService>(LocationService(), permanent: true);
    Get.put<ImageWatermarkService>(ImageWatermarkService(), permanent: true);
    Get.put<SecurityPlatformService>(SecurityPlatformService(), permanent: true);
    Get.put<MapsNavigationService>(MapsNavigationService(), permanent: true);
    Get.put<CameraService>(CameraService(), permanent: true);
    Get.put<VoiceRecordingService>(VoiceRecordingService(), permanent: true);
    Get.put<UploadService>(UploadService(), permanent: true);

    await Get.putAsync<ApiService>(() => ApiService().init(), permanent: true);

    Get.put<DummyApiService>(DummyApiService(), permanent: true);
    Get.put<RemoteApiService>(RemoteApiService(), permanent: true);
    Get.put<NdfaApiService>(NdfaApiService(), permanent: true);
    Get.put<SyncService>(SyncService(), permanent: true);
    Get.put<TrackingService>(TrackingService(), permanent: true);
    Get.put<DataRefreshService>(DataRefreshService(), permanent: true);
    Get.put<CallService>(CallService(), permanent: true);
    Get.put<NotificationService>(NotificationService(), permanent: true);
  }

  /// Background work after first UI frame — never blocks open.
  static Future<void> initDeferred() async {
    if (_deferredStarted) return;
    _deferredStarted = true;

    try {
      if (Get.isRegistered<SyncService>()) {
        await Get.find<SyncService>().init();
      }
    } catch (_) {}

    try {
      if (Get.isRegistered<TrackingService>()) {
        await Get.find<TrackingService>().init();
      }
    } catch (_) {}

    try {
      if (Get.isRegistered<DataRefreshService>()) {
        await Get.find<DataRefreshService>().init();
      }
    } catch (_) {}

    try {
      if (Get.isRegistered<NotificationService>()) {
        await Get.find<NotificationService>().init();
      }
    } catch (_) {}
  }
}
