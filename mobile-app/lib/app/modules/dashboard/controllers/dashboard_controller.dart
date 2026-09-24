import 'package:get/get.dart';
import '../../../data/models/dashboard_stats.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/services/tracking_service.dart';
import '../../../utils/api_errors.dart';
import '../../../utils/access_control.dart';

class DashboardController extends GetxController {
  NdfaApiService get _api => Get.find<NdfaApiService>();
  StorageService get _storage => Get.find<StorageService>();
  TrackingService get _tracking => Get.find<TrackingService>();

  final Rx<DashboardStats?> stats = Rx<DashboardStats?>(null);
  final isLoading = true.obs;
  final selectedNavIndex = 0.obs;

  @override
  void onInit() {
    super.onInit();
    loadStats();
  }

  Future<void> loadStats() async {
    if (!AccessControl.showDashboard) {
      isLoading.value = false;
      return;
    }
    isLoading.value = true;
    try {
      final data = await _api.getDashboardStats();
      stats.value = data.copyWith(distanceCoveredToday: _tracking.totalKmToday.value);
    } catch (e) {
      if (!isSessionExpiredError(e)) {
        Get.snackbar('Error', apiErrorMessage(e));
      }
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> refresh() async => loadStats();

  String get userName => _storage.getUser()?.name ?? 'User';
  String get userRole => _storage.getUser()?.role.label ?? '';
}
