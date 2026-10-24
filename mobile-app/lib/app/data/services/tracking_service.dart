import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/attendance_model.dart';
import '../models/tracking_model.dart';
import 'storage_service.dart';
import 'api_constants.dart';
import 'location_service.dart';
import 'ndfa_api_service.dart';

/// Duty GPS — starts on attendance check-in, stops on check-out.
/// Sends one fix every 15 seconds; the server works out the distance.
class TrackingService extends GetxService {
  StorageService get _storage => Get.find<StorageService>();
  LocationService get _locationService => Get.find<LocationService>();
  NdfaApiService get _api => Get.find<NdfaApiService>();

  static const Duration _pingInterval = Duration(seconds: 15);

  /// A fix older than this is replaced by asking the GPS directly.
  static const Duration _staleFix = Duration(seconds: 25);
  static const String _pendingKey = 'pending_track_fixes';
  static const String _batteryPromptKey = 'tracking_battery_prompted';
  static const int _maxPending = 3000;

  /// Only clear fixes are drawn on the phone's own route map.
  static const double _maxDrawAccuracy = 35;
  static const double _minDrawStep = 20;

  final RxBool isTracking = false.obs;
  final RxDouble totalKmToday = 0.0.obs;
  final RxList<RoutePoint> routePoints = <RoutePoint>[].obs;
  Timer? _trackingTimer;
  StreamSubscription<Position>? _positionStream;
  Position? _latest;
  DateTime? _lastSentFix;
  bool _sending = false;

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
        (a) =>
            a.date.year == today.year &&
            a.date.month == today.month &&
            a.date.day == today.day,
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
      return;
    }
    final today = DateTime.now();
    final todayReport = _getAllReports().firstWhereOrNull(
      (r) =>
          r.date.year == today.year &&
          r.date.month == today.month &&
          r.date.day == today.day,
    );
    if (todayReport != null) {
      totalKmToday.value = todayReport.totalKm;
      routePoints.assignAll(todayReport.routePoints);
    }
  }

  void _applyServerReport(Map<String, dynamic> data) {
    totalKmToday.value = (data['totalKm'] ?? 0).toDouble();
    final pts = data['routePoints'];
    if (pts is List) {
      routePoints.assignAll(pts.map(
          (e) => RoutePoint.fromJson(Map<String, dynamic>.from(e as Map))));
    }
  }

  List<TravelReport> _getAllReports() {
    final data = _storage.readList(ApiConstants.routeHistoryKey);
    return data.map((e) => TravelReport.fromJson(e)).toList();
  }

  void _saveReport(TravelReport report) {
    final reports = _getAllReports();
    final index = reports.indexWhere(
      (r) =>
          r.date.year == report.date.year &&
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

  LocationSettings _streamSettings() {
    if (GetPlatform.isAndroid) {
      return AndroidSettings(
        accuracy: LocationAccuracy.best,
        distanceFilter: 0,
        intervalDuration: _pingInterval,
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'On duty — location sharing',
          notificationText:
              'Smartstaff plus shares your location with your branch until you check out.',
          notificationChannelName: 'Duty location',
          enableWakeLock: true,
          setOngoing: true,
        ),
      );
    }
    if (GetPlatform.isIOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.best,
        distanceFilter: 0,
        activityType: ActivityType.otherNavigation,
        pauseLocationUpdatesAutomatically: false,
      );
    }
    return const LocationSettings(
        accuracy: LocationAccuracy.high, distanceFilter: 0);
  }

  /// Keeps Android from pausing duty GPS to save battery. Asked once.
  Future<void> _askBatteryExemption() async {
    if (!GetPlatform.isAndroid ||
        _storage.read<bool>(_batteryPromptKey) == true) {
      return;
    }
    _storage.write(_batteryPromptKey, true);
    try {
      if (!await Permission.ignoreBatteryOptimizations.isGranted) {
        await Permission.ignoreBatteryOptimizations.request();
      }
    } catch (_) {}
  }

  Future<void> startTracking({bool silent = false}) async {
    if (isTracking.value) return;

    final hasPermission = await _locationService.requestPermission();
    if (!hasPermission) {
      if (!silent) Get.snackbar('Tracking', 'Location permission required');
      return;
    }
    if (GetPlatform.isAndroid) {
      try {
        await Permission.notification.request();
      } catch (_) {}
    }
    if (!silent) await _askBatteryExemption();

    isTracking.value = true;
    final now = DateTime.now();

    _positionStream =
        Geolocator.getPositionStream(locationSettings: _streamSettings())
            .listen(
      _onPosition,
      onError: (_) {},
    );

    final first = await _freshFix();
    if (first != null) _onPosition(first);
    unawaited(_sendLatest());

    _trackingTimer = Timer.periodic(_pingInterval, (_) => _tick());

    if (!silent) {
      Get.snackbar('Duty tracking on',
          'Your location is shared every 15 seconds until check-out');
    }

    _saveReport(TravelReport(
      date: DateTime(now.year, now.month, now.day),
      routePoints: routePoints.toList(),
      totalKm: totalKmToday.value,
      startTime: now,
    ));
  }

  Future<Position?> _freshFix() async {
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.best,
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (_) {
      try {
        return await Geolocator.getLastKnownPosition();
      } catch (_) {
        return null;
      }
    }
  }

  void _onPosition(Position p) {
    final prev = _latest;
    if (prev == null || !p.timestamp.isBefore(prev.timestamp)) _latest = p;
    _addDrawPoint(p);
  }

  Future<void> _tick() async {
    final latest = _latest;
    if (latest == null ||
        DateTime.now().difference(latest.timestamp) > _staleFix) {
      final fix = await _freshFix();
      if (fix != null) _onPosition(fix);
    }
    await _sendLatest();
  }

  Map<String, dynamic> _fixJson(Position p) => {
        'lat': p.latitude,
        'lng': p.longitude,
        'accuracy': p.accuracy,
        if (p.speed >= 0) 'speed': p.speed,
        if (p.heading >= 0) 'heading': p.heading,
        'recordedAt': p.timestamp.toUtc().toIso8601String(),
        'mocked': p.isMocked,
      };

  /// Sends the newest fix. Without internet it is kept and sent later in order.
  Future<void> _sendLatest() async {
    final p = _latest;
    if (_sending || p == null) return;
    if (_lastSentFix != null && !p.timestamp.isAfter(_lastSentFix!)) return;
    _sending = true;
    final fix = _fixJson(p);
    try {
      final pending = _storage.readList(_pendingKey);
      final Map<String, dynamic> data;
      if (pending.isEmpty) {
        data = await _api.sendLiveTrackingPing(fix);
      } else {
        data = await _api.syncRoutePoints([...pending, fix]);
        _storage.remove(_pendingKey);
        _applyServerReport(data);
      }
      if (data['totalKm'] != null) {
        totalKmToday.value = (data['totalKm'] as num).toDouble();
      }
    } catch (_) {
      final pending = _storage.readList(_pendingKey)..add(fix);
      _storage.writeList(
        _pendingKey,
        pending.length > _maxPending
            ? pending.sublist(pending.length - _maxPending)
            : pending,
      );
    } finally {
      _lastSentFix = p.timestamp;
      _sending = false;
    }
  }

  Future<void> _flushPending() async {
    final pending = _storage.readList(_pendingKey);
    if (pending.isEmpty) return;
    try {
      final data = await _api.syncRoutePoints(pending);
      _storage.remove(_pendingKey);
      _applyServerReport(data);
    } catch (_) {}
  }

  void _addDrawPoint(Position p) {
    if (p.accuracy > _maxDrawAccuracy) return;
    if (routePoints.isNotEmpty) {
      final last = routePoints.last;
      final step = _locationService.calculateDistance(
          last.latitude, last.longitude, p.latitude, p.longitude);
      if (step < _minDrawStep) return;
    }
    routePoints.add(RoutePoint(
        latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp));
    if (!ApiConstants.useRemoteApi) _recalculateDistance();
  }

  /// Offline demo mode only — with the server, distance comes from the API.
  void _recalculateDistance() {
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

    await _sendLatest();
    await _flushPending();
    await _loadTodayReport();
    _latest = null;
    _lastSentFix = null;

    final now = DateTime.now();
    _saveReport(TravelReport(
      date: DateTime(now.year, now.month, now.day),
      routePoints: routePoints.toList(),
      totalKm: totalKmToday.value,
      endTime: now,
    ));

    if (!silent) {
      Get.snackbar('Tracking ended',
          'Total: ${totalKmToday.value.toStringAsFixed(2)} KM');
    }
  }

  Future<void> refreshTodayFromServer() => _loadTodayReport();

  List<TravelReport> getTravelHistory() => _getAllReports();

  TravelReport? getTodayReport() {
    final today = DateTime.now();
    return _getAllReports().firstWhereOrNull(
      (r) =>
          r.date.year == today.year &&
          r.date.month == today.month &&
          r.date.day == today.day,
    );
  }

  @override
  void onClose() {
    _trackingTimer?.cancel();
    _positionStream?.cancel();
    super.onClose();
  }
}
