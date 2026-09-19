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

/// Registers all app services before [runApp]. Order matters for dependencies.
class AppInitializer {
  AppInitializer._();

  static Future<void> init() async {
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
    Get.put<CallService>(CallService(), permanent: true);

    await Get.putAsync<ApiService>(() => ApiService().init(), permanent: true);

    Get.put<DummyApiService>(DummyApiService(), permanent: true);
    Get.put<RemoteApiService>(RemoteApiService(), permanent: true);
    Get.put<NdfaApiService>(NdfaApiService(), permanent: true);
    await Get.putAsync<TrackingService>(() => TrackingService().init(), permanent: true);
    await Get.putAsync<SyncService>(() => SyncService().init(), permanent: true);
    await Get.putAsync<DataRefreshService>(() => DataRefreshService().init(), permanent: true);
    await Get.putAsync<NotificationService>(() => NotificationService().init(), permanent: true);
  }
}
