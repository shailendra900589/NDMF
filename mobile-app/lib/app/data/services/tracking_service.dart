import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import '../models/attendance_model.dart';
import '../models/tracking_model.dart';
import 'storage_service.dart';
import 'api_constants.dart';
import 'location_service.dart';
import 'ndfa_api_service.dart';

/// GPS route tracking — starts on attendance check-in, stops on check-out.
class TrackingService extends GetxService {
  StorageService get _storage => Get.find<StorageService>();
  LocationService get _locationService => Get.find<LocationService>();
  NdfaApiService get _api => Get.find<NdfaApiService>();

  static const double _minSegmentMeters = 25;

  final RxBool isTracking = false.obs;
  final RxDouble totalKmToday = 0.0.obs;
  final RxList<RoutePoint> routePoints = <RoutePoint>[].obs;
  Timer? _trackingTimer;
  StreamSubscription<Position>? _positionStream;

  Future<TrackingService> init() async {
    // Fire-and-forget — never block app open on GPS/API.
    unawaited(_bootstrap());
    return this;
  }

  Future<void> _bootstrap() async {
    try {
      await _loadTodayReport();
      await _resumeFromAttendanceIfNeeded();
    } catch (_) {}
  }

  Future<void> _resumeFromAttendanceIfNeeded() async {
    try {
      final history = await _api.getAttendanceHistory();
      final today = DateTime.now();
      final todayAtt = history.firstWhereOrNull(
        (a) => a.date.year == today.year && a.date.month == today.month && a.date.day == today.day,
      );
      await syncWithAttendanceState(todayAtt);
    } catch (_) {}
  }

  Future<void> _loadTodayReport() async {
    if (ApiConstants.useRemoteApi) {
      try {
        final data = await _api.getTrackingToday();
        _applyServerReport(data);
      } catch (_) {}
    }
    final reports = _getAllReports();
    final today = DateTime.now();
    final todayReport = reports.firstWhereOrNull(
      (r) => r.date.year == today.year && r.date.month == today.month && r.date.day == today.day,
    );
    if (todayReport != null && !ApiConstants.useRemoteApi) {
      totalKmToday.value = todayReport.totalKm;
      routePoints.assignAll(todayReport.routePoints);
    }
  }

  void _applyServerReport(Map<String, dynamic> data) {
    totalKmToday.value = (data['totalKm'] ?? 0).toDouble();
    final pts = data['routePoints'];
    if (pts is List && pts.isNotEmpty) {
      routePoints.assignAll(pts.map((e) => RoutePoint.fromJson(Map<String, dynamic>.from(e as Map))));
    }
  }

  List<TravelReport> _getAllReports() {
    final data = _storage.readList(ApiConstants.routeHistoryKey);
    return data.map((e) => TravelReport.fromJson(e)).toList();
  }

  void _saveReport(TravelReport report) {
    final reports = _getAllReports();
    final index = reports.indexWhere(
      (r) => r.date.year == report.date.year &&
          r.date.month == report.date.month &&
          r.date.day == report.date.day,
    );
    if (index >= 0) {
      reports[index] = report;
    } else {
      reports.add(report);
    }
    _storage.writeList(
      ApiConstants.routeHistoryKey,
      reports.map((e) => e.toJson()).toList(),
    );
  }

  Future<void> _syncToBackend() async {
    if (!ApiConstants.useRemoteApi || routePoints.isEmpty) return;
    try {
      final data = await _api.syncRoutePoints(routePoints.map((p) => p.toJson()).toList());
      if (data['totalKm'] != null) {
        totalKmToday.value = (data['totalKm'] as num).toDouble();
      }
      _applyServerReport(data);
    } catch (_) {}
  }

  /// Align tracking with today's attendance (check-in open → track, check-out → stop).
  Future<void> syncWithAttendanceState(AttendanceModel? today) async {
    final onDuty = today != null && today.isCheckedIn && !today.isCheckedOut;
    if (onDuty) {
      if (!isTracking.value) await startTracking(silent: true);
    } else if (isTracking.value) {
      await stopTracking(silent: true);
    } else {
      await _loadTodayReport();
    }
  }

  Future<void> startTracking({bool silent = false}) async {
    if (isTracking.value) return;

    final hasPermission = await _locationService.requestPermission();
    if (!hasPermission) {
      if (!silent) Get.snackbar('Tracking', 'Location permission required');
      return;
    }

    isTracking.value = true;
    final now = DateTime.now();

    final loc = await _locationService.getCurrentLocation();
    if (loc != null) _addRoutePoint(loc.latitude, loc.longitude, force: true);

    _trackingTimer = Timer.periodic(const Duration(seconds: 45), (_) async {
      final location = await _locationService.getCurrentLocation();
      if (location != null) {
        _addRoutePoint(location.latitude, location.longitude);
        await _syncToBackend();
      }
    });

    _positionStream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 30,
      ),
    ).listen((position) {
      _addRoutePoint(position.latitude, position.longitude);
    });

    if (!silent) {
      Get.snackbar('Route tracking', 'Live GPS active for today\'s field visit');
    }

    final report = TravelReport(
      date: DateTime(now.year, now.month, now.day),
      routePoints: routePoints.toList(),
      totalKm: totalKmToday.value,
      startTime: now,
    );
    _saveReport(report);
  }

  void _addRoutePoint(double lat, double lng, {bool force = false}) {
    if (routePoints.isNotEmpty && !force) {
      final last = routePoints.last;
      final segment = _locationService.calculateDistance(
        last.latitude,
        last.longitude,
        lat,
        lng,
      );
      if (segment < _minSegmentMeters) return;
    }

    routePoints.add(RoutePoint(
      latitude: lat,
      longitude: lng,
      timestamp: DateTime.now(),
    ));
    _recalculateDistance();
  }

  void _recalculateDistance() {
    if (routePoints.length < 2) {
      totalKmToday.value = 0;
      return;
    }
    double total = 0;
    for (int i = 0; i < routePoints.length - 1; i++) {
      total += _locationService.calculateDistance(
        routePoints[i].latitude,
        routePoints[i].longitude,
        routePoints[i + 1].latitude,
        routePoints[i + 1].longitude,
      );
    }
    totalKmToday.value = double.parse((total / 1000).toStringAsFixed(2));
  }

  Future<void> stopTracking({bool silent = false}) async {
    if (!isTracking.value) return;

    _trackingTimer?.cancel();
    _trackingTimer = null;
    await _positionStream?.cancel();
    _positionStream = null;
    isTracking.value = false;

    await _syncToBackend();

    final now = DateTime.now();
    final report = TravelReport(
      date: DateTime(now.year, now.month, now.day),
      routePoints: routePoints.toList(),
      totalKm: totalKmToday.value,
      endTime: now,
    );
    _saveReport(report);

    if (!silent) {
      Get.snackbar('Tracking ended', 'Total: ${totalKmToday.value.toStringAsFixed(2)} KM');
    }
  }

  Future<void> refreshTodayFromServer() => _loadTodayReport();

  List<TravelReport> getTravelHistory() => _getAllReports();

  TravelReport? getTodayReport() {
    final today = DateTime.now();
    return _getAllReports().firstWhereOrNull(
      (r) => r.date.year == today.year && r.date.month == today.month && r.date.day == today.day,
    );
  }

  @override
  void onClose() {
    _trackingTimer?.cancel();
    _positionStream?.cancel();
    super.onClose();
  }
}
