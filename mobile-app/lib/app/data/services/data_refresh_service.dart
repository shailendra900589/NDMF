import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:get/get.dart';
import 'api_constants.dart';
import 'call_service.dart';
import 'connectivity_service.dart';
import 'ndfa_api_service.dart';
import 'storage_service.dart';
import 'sync_service.dart';

/// Keeps mobile app in sync with web backend (no separate app backend).
class DataRefreshService extends GetxService with WidgetsBindingObserver {
  static const Duration _interval = Duration(seconds: 45);

  Timer? _timer;
  final lastRefreshAt = Rxn<DateTime>();
  final isRefreshing = false.obs;

  ConnectivityService get _connectivity => Get.find<ConnectivityService>();
  NdfaApiService get _api => Get.find<NdfaApiService>();
  StorageService get _storage => Get.find<StorageService>();

  Future<DataRefreshService> init() async {
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(_interval, (_) => refreshAll(silent: true));
    await refreshAll(silent: true);
    return this;
  }

  @override
  void onClose() {
    _timer?.cancel();
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
      if (Get.isRegistered<SyncService>()) {
        await Get.find<SyncService>().syncPendingRecords(silent: silent);
      }
      if (Get.isRegistered<CallService>()) {
        await Get.find<CallService>().refreshFromServer();
      }
      await _pullListingsCache();
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

  Future<void> _pullListingsCache() async {
    try {
      final list = await _api.getCustomerListings();
      _storage.writeList(
        ApiConstants.customerListingsKey,
        list.map((e) => e.toJson()).toList(),
      );
    } catch (_) {}
  }
}
