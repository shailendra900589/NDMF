import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter/services.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/attendance_model.dart';
import '../models/tracking_model.dart';
import 'storage_service.dart';
import 'api_constants.dart';
import 'location_service.dart';
import 'ndfa_api_service.dart';
import 'api_service.dart';
import '../../utils/api_errors.dart';
import '../../utils/attendance_state.dart';

/// Duty GPS — starts on attendance check-in, stops on check-out.
/// Sends one fix every 15 seconds; the server works out the distance.
class TrackingService extends GetxService with WidgetsBindingObserver {
  StorageService get _storage => Get.find<StorageService>();
  LocationService get _locationService => Get.find<LocationService>();
  NdfaApiService get _api => Get.find<NdfaApiService>();

  static const Duration _pingInterval = Duration(seconds: 15);

  /// The Android foreground service owns collection while the phone is locked.
  /// Keep a lightweight watchdog while Flutter is visible so an OEM-killed
  /// service is restarted instead of silently leaving an employee on duty with
  /// only the check-in point.
  static const Duration _nativeWatchInterval = Duration(seconds: 30);

  /// A fix older than this is replaced by asking the GPS directly.
  static const Duration _staleFix = Duration(seconds: 25);
  String get _pendingKey =>
      'pending_track_fixes_${_storage.getUser()?.id ?? 'signed_out'}';
  static const String _batteryPromptKey = 'tracking_battery_prompted';
  static const int _maxPending = 3000;

  /// Only clear fixes are drawn on the phone's own route map.
  static const double _maxDrawAccuracy = 35;
  static const double _minDrawStep = 20;

  final RxBool isTracking = false.obs;
  final RxDouble totalKmToday = 0.0.obs;
  final RxList<RoutePoint> routePoints = <RoutePoint>[].obs;
  final RxString gpsStatus = 'GPS not started'.obs;
  final Rxn<DateTime> lastGpsFixAt = Rxn<DateTime>();
  final Rxn<DateTime> lastUploadAt = Rxn<DateTime>();
  Timer? _trackingTimer;
  StreamSubscription<Position>? _positionStream;
  Position? _latest;
  DateTime? _lastSentFix;
  bool _sending = false;
  bool _starting = false;
  String? _trackingOwner;
  bool _ticking = false, _heartbeatBusy = false, _restartNeeded = false;
  String? _appVersion;
  static const _nativeChannel =
      MethodChannel('com.nirmaldhara.microfinance/duty_location');
  bool _nativeActive = false;
  Future<void> _startNative() async {
    if (!GetPlatform.isAndroid || !ApiConstants.useRemoteApi) return;
    try {
      _appVersion ??= (await PackageInfo.fromPlatform()).version;
      _nativeActive = await _nativeChannel.invokeMethod<bool>('start', {
            'token': _storage.getToken(),
            'owner': _storage.getUser()?.id,
            'baseUrl': ApiConstants.baseUrl,
            'version': _appVersion
          }) ??
          false;
    } catch (_) {
      _nativeActive = false;
      gpsStatus.value = 'Open Attendance to enable background GPS';
    }
  }

  Future<void> _stopNative() async {
    if (GetPlatform.isAndroid)
      try {
        await _nativeChannel.invokeMethod('stop');
      } catch (_) {}
    _nativeActive = false;
  }

  Future<TrackingService> init() async {
    WidgetsBinding.instance.addObserver(this);
    // Fire-and-forget — never block app open on GPS/API.
    unawaited(_bootstrap());
    return this;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (isTracking.value) {
        unawaited(_startNative());
        unawaited(_tick());
      }
      unawaited(_resumeFromAttendanceIfNeeded());
      if (isTracking.value) unawaited(_tick());
    }
  }

  Future<void> _heartbeat() async {
    if (_nativeActive) return;
    if (_heartbeatBusy || !_storage.isLoggedIn || !ApiConstants.useRemoteApi)
      return;
    _heartbeatBusy = true;
    try {
      try {
        _appVersion ??= (await PackageInfo.fromPlatform()).version;
      } catch (_) {
        _appVersion ??= 'unknown';
      }
      final permission = await Geolocator.checkPermission();
      await Get.find<ApiService>().post('/tracking/heartbeat', data: {
        'locationEnabled': await Geolocator.isLocationServiceEnabled(),
        'permission': permission == LocationPermission.always ||
                permission == LocationPermission.whileInUse
            ? 'granted'
            : 'denied',
        'backgroundAllowed': permission == LocationPermission.always,
        'trackingActive': isTracking.value,
        'appVersion': _appVersion,
        'issue': gpsStatus.value
      });
    } catch (_) {
      /* Network recovery retries independently of GPS fixes. */
    } finally {
      _heartbeatBusy = false;
    }
  }

  Future<void> _restartStream() async {
    await _positionStream?.cancel();
    _positionStream =
        Geolocator.getPositionStream(locationSettings: _streamSettings())
            .listen(_onPosition, onError: (Object error) {
      gpsStatus.value = _gpsErrorLabel(error);
      _restartNeeded = true;
    }, onDone: () {
      _restartNeeded = true;
    });
    _restartNeeded = false;
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
      final todayAtt =
          ownAttendanceState(history, _storage.getUser()?.id ?? '');
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
    unawaited(_heartbeat());
    if (_trackingOwner != null && _trackingOwner != _storage.getUser()?.id) {
      await stopTracking(silent: true);
      _latest = null;
      _lastSentFix = null;
      routePoints.clear();
      totalKmToday.value = 0;
      _trackingOwner = null;
    }
    final onDuty = today != null && today.isCheckedIn && !today.isCheckedOut;
    if (onDuty) {
      if (!isTracking.value) await startTracking(silent: true);
    } else if (isTracking.value) {
      await stopTracking(silent: true);
    } else {
      await _stopNative();
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
              'MyStaff Smart shares your location with your branch until you check out.',
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

  Future<void> _prepareBackgroundTracking() async {
    if (!GetPlatform.isAndroid) return;
    final backgroundAllowed =
        await _locationService.requestDutyBackgroundPermission();
    if (!backgroundAllowed && gpsStatus.value == 'GPS not started') {
      gpsStatus.value = 'GPS active while app is open';
    }
    unawaited(_askBatteryExemption());
  }

  Future<void> startTracking({bool silent = false}) async {
    if (isTracking.value || _starting) return;
    _starting = true;
    try {
      _trackingOwner = _storage.getUser()?.id;

      final existingPermission = await Geolocator.checkPermission();
      if (silent &&
          (!await Geolocator.isLocationServiceEnabled() ||
              (existingPermission != LocationPermission.always &&
                  existingPermission != LocationPermission.whileInUse))) {
        gpsStatus.value =
            'Enable precise location permission to resume duty GPS';
        unawaited(_heartbeat());
        return;
      }
      final hasPermission =
          silent ? true : await _locationService.requestPermission();
      if (!hasPermission) {
        if (!silent) Get.snackbar('Tracking', 'Location permission required');
        return;
      }
      if (GetPlatform.isAndroid) {
        try {
          await Permission.notification.request();
        } catch (_) {}
      }
      // This also runs when tracking resumes after check-in. Previously the
      // silent resume path skipped battery/background preparation altogether.
      unawaited(_prepareBackgroundTracking());

      isTracking.value = true;
      await _startNative();
      gpsStatus.value = 'Searching for GPS…';
      final now = DateTime.now();

      // Android owns on-duty collection in a foreground service.  Keep a
      // small watchdog in Flutter while the app is open. If an aggressive OEM
      // stops that service, the app restarts it or falls back to its own
      // stream; it never silently stops sending route points.
      if (_nativeActive) {
        await _positionStream?.cancel();
        _positionStream = null;
        _trackingTimer?.cancel();
        _trackingTimer =
            Timer.periodic(_nativeWatchInterval, (_) => unawaited(_tick()));
        gpsStatus.value = 'On duty — background GPS sharing is active';
        unawaited(_heartbeat());
        if (!silent)
          Get.snackbar(
              'Duty tracking on', 'Background GPS is active until check-out');
        return;
      }

      _trackingTimer?.cancel();
      _trackingTimer = Timer.periodic(_pingInterval, (_) => unawaited(_tick()));
      unawaited(_heartbeat());
      try {
        await _restartStream();
      } catch (e) {
        _restartNeeded = true;
        gpsStatus.value = _gpsErrorLabel(e);
      }

      final first = await _freshFix();
      if (first != null) {
        _onPosition(first);
      } else {
        gpsStatus.value = 'Waiting for a GPS fix';
      }
      unawaited(_sendLatest());

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
    } finally {
      _starting = false;
    }
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
    if (p.isMocked) {
      gpsStatus.value = 'Mock location rejected';
      return;
    }
    if (DateTime.now().difference(p.timestamp) > const Duration(seconds: 60))
      return;
    final prev = _latest;
    if (prev == null || !p.timestamp.isBefore(prev.timestamp)) _latest = p;
    lastGpsFixAt.value = p.timestamp.toLocal();
    gpsStatus.value = p.accuracy > 100
        ? 'GPS signal is weak (${p.accuracy.round()} m)'
        : 'GPS connected · ${p.accuracy.round()} m accuracy';
    _addDrawPoint(p);
    // Stream callbacks can arrive while screen-off timers are throttled.
    if (!_nativeActive) unawaited(_sendLatest());
  }

  Future<void> _tick() async {
    if (_nativeActive) {
      try {
        _nativeActive =
            await _nativeChannel.invokeMethod<bool>('running') ?? false;
      } catch (_) {
        _nativeActive = false;
      }
      if (_nativeActive) {
        unawaited(_heartbeat());
        return;
      }
      // A foreground service can be stopped by an OEM battery manager. Try to
      // restore the durable native collector first; if it cannot start, use
      // Flutter's stream while this app remains open.
      gpsStatus.value = 'Restoring background GPS sharing…';
      await _startNative();
      if (_nativeActive) {
        gpsStatus.value = 'On duty — background GPS sharing is active';
        unawaited(_heartbeat());
        return;
      }
      try {
        await _restartStream();
      } catch (_) {
        _restartNeeded = true;
      }
      _trackingTimer?.cancel();
      _trackingTimer = Timer.periodic(_pingInterval, (_) => unawaited(_tick()));
    }
    unawaited(_heartbeat());
    if (_ticking) return;
    _ticking = true;
    try {
      if (!_storage.isLoggedIn) {
        await stopTracking(silent: true);
        return;
      }
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        gpsStatus.value = 'Device location is switched off';
        await _sendLatest();
        return;
      }
      if (_latest != null &&
          DateTime.now().difference(_latest!.timestamp) >
              const Duration(seconds: 60)) _restartNeeded = true;
      if (_restartNeeded) await _restartStream();
      final latest = _latest;
      if (latest == null ||
          DateTime.now().difference(latest.timestamp) > _staleFix) {
        gpsStatus.value = 'Refreshing GPS signal…';
        final fix = await _freshFix();
        if (fix != null) {
          _onPosition(fix);
        } else {
          gpsStatus.value = 'No GPS fix yet — check location permission';
        }
      }
      await _sendLatest();
    } catch (e) {
      gpsStatus.value = _gpsErrorLabel(e);
      _restartNeeded = true;
    } finally {
      _ticking = false;
    }
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
    if (_nativeActive) return;
    final p = _latest;
    if (_sending || !_storage.isLoggedIn) return;
    if (_trackingOwner != null && _trackingOwner != _storage.getUser()?.id)
      return;
    final hasFresh = p != null &&
        (_lastSentFix == null || p.timestamp.isAfter(_lastSentFix!)) &&
        DateTime.now().difference(p.timestamp) <= const Duration(seconds: 60);
    final key = _pendingKey;
    final pending = _storage.readList(key);
    if (!hasFresh && pending.isEmpty) return;
    _sending = true;
    final fix = hasFresh ? _fixJson(p) : null;
    final batch = [...pending];
    if (fix != null && !batch.any((e) => e['recordedAt'] == fix['recordedAt']))
      batch.add(fix);
    if (batch.length > _maxPending) {
      batch.removeRange(0, batch.length - _maxPending);
    }
    try {
      final Map<String, dynamic> data;
      if (pending.isEmpty && fix != null) {
        data = await _api.sendLiveTrackingPing(fix);
      } else {
        data = await _api.syncRoutePoints(batch);
        final sent = batch.map((e) => e['recordedAt']).toSet();
        await _storage.writeListDurable(
            key,
            _storage
                .readList(key)
                .where((e) => !sent.contains(e['recordedAt']))
                .toList());
        _applyServerReport(data);
      }
      if (hasFresh) _lastSentFix = p.timestamp;
      if (data['totalKm'] != null) {
        totalKmToday.value = (data['totalKm'] as num).toDouble();
      }
      lastUploadAt.value = DateTime.now();
      if (data['onDuty'] == false) {
        gpsStatus.value = 'GPS received; attendance duty is not open';
      }
    } catch (e) {
      final saved = _storage.readList(key);
      if (fix != null &&
          !saved.any((e) => e['recordedAt'] == fix['recordedAt']))
        saved.add(fix);
      await _storage.writeListDurable(
          key,
          saved.length > _maxPending
              ? saved.sublist(saved.length - _maxPending)
              : saved);
      gpsStatus.value = 'GPS queued · ${apiErrorMessage(e)}';
    } finally {
      _sending = false;
    }
  }

  String _gpsErrorLabel(Object error) {
    final text = error.toString().toLowerCase();
    if (text.contains('permission')) return 'Location permission is required';
    if (text.contains('disabled')) return 'Turn on device location';
    if (text.contains('timeout')) return 'GPS signal timeout — trying again';
    return 'GPS unavailable — trying again';
  }

  Future<void> _flushPending() async {
    await _sendLatest();
  }

  Future<void> retryPendingUploads() => _sendLatest();

  void _addDrawPoint(Position p) {
    if (ApiConstants.useRemoteApi) return;
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
    await _stopNative();
    if (!isTracking.value) return;

    _trackingTimer?.cancel();
    _trackingTimer = null;
    await _positionStream?.cancel();
    _positionStream = null;
    isTracking.value = false;
    gpsStatus.value = 'Duty ended';

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
    WidgetsBinding.instance.removeObserver(this);
    _trackingTimer?.cancel();
    _positionStream?.cancel();
    super.onClose();
  }
}
