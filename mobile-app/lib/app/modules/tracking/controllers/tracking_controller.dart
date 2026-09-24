import 'package:get/get.dart';
import '../../../data/models/tracking_model.dart';
import '../../../data/services/tracking_service.dart';

class TrackingController extends GetxController {
  final TrackingService _tracking = Get.find<TrackingService>();

  final travelHistory = <TravelReport>[].obs;

  RxBool get isTracking => _tracking.isTracking;
  RxDouble get totalKmToday => _tracking.totalKmToday;
  RxList<RoutePoint> get routePoints => _tracking.routePoints;

  @override
  void onInit() {
    super.onInit();
    loadHistory();
    _tracking.refreshTodayFromServer();
  }

  void loadHistory() {
    travelHistory.value = _tracking.getTravelHistory();
  }

  @override
  Future<void> refresh() async {
    await _tracking.refreshTodayFromServer();
    loadHistory();
  }

  TravelReport? get todayReport => _tracking.getTodayReport();
}
