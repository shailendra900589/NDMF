import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:get/get.dart';
import 'api_constants.dart';
import 'call_service.dart';
import 'connectivity_service.dart';
import 'ndfa_api_service.dart';
import 'storage_service.dart';
import 'sync_service.dart';
import 'tracking_service.dart';
import '../../utils/attendance_state.dart';

/// Keeps mobile app in sync with web backend (no separate app backend).
class DataRefreshService extends GetxService with WidgetsBindingObserver {
  static const Duration _interval = Duration(seconds: 45);

  Timer? _timer;
  Worker? _connectionWorker;
  final lastRefreshAt = Rxn<DateTime>();
  final isRefreshing = false.obs;

  ConnectivityService get _connectivity => Get.find<ConnectivityService>();
  NdfaApiService get _api => Get.find<NdfaApiService>();
  StorageService get _storage => Get.find<StorageService>();

  Future<DataRefreshService> init() async {
    WidgetsBinding.instance.addObserver(this);
    _connectionWorker = ever(_connectivity.isOnline, (online) {
      if (online) unawaited(refreshAll(silent: true));
    });
    _timer = Timer.periodic(_interval, (_) => refreshAll(silent: true));
    // Do not await — refresh in background so app open stays fast.
    unawaited(refreshAll(silent: true));
    return this;
  }

  @override
  void onClose() {
    _timer?.cancel();
    _connectionWorker?.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.onClose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      refreshAll(silent: true);
    }
  }

  Future<void> refreshAll({bool silent = false}) async {
    if (!ApiConstants.useRemoteApi) return;
    if (!_connectivity.isOnline.value || isRefreshing.value) return;
    if (_storage.getToken()?.isEmpty ?? true) return;

    isRefreshing.value = true;
    try {
      // Refresh role, company policy and face enrollment before background work.
      await _api.syncSession();
      if (!_storage.isLoggedIn) return;
      if (Get.isRegistered<SyncService>()) {
        await Get.find<SyncService>().syncPendingRecords(silent: silent);
      }
      if (Get.isRegistered<CallService>()) {
        await Get.find<CallService>().refreshFromServer();
      }
      await Future.wait([
        _pullCustomersCache(),
        _pullAttendanceCache(),
      ]);
      lastRefreshAt.value = DateTime.now();
      if (!silent) {
        Get.snackbar('Updated', 'Latest data synced from server');
      }
    } catch (_) {
      if (!silent) Get.snackbar('Sync', 'Could not refresh from server');
    } finally {
      isRefreshing.value = false;
    }
  }

  Future<void> _pullCustomersCache() async {
    if (_storage.getPermissions()['customers'] != true) return;
    try {
      final list = await _api.getCustomers();
      _storage.writeList(
        'customers_cache',
        list.map((e) => e.toJson()).toList(),
      );
    } catch (_) {}
  }

  Future<void> _pullAttendanceCache() async {
    if (_storage.getPermissions()['attendance'] != true) return;
    try {
      final list = await _api.getAttendanceHistory();
      if (Get.isRegistered<TrackingService>())
        await Get.find<TrackingService>().syncWithAttendanceState(
            ownAttendanceState(list, _storage.getUser()?.id ?? ''));
      _storage.writeList(
        ApiConstants.attendanceKey,
        list.map((e) => e.toJson()).toList(),
      );
    } catch (_) {}
  }
}
