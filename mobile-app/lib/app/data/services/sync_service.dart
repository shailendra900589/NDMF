import 'package:get/get.dart';
import '../models/call_log_model.dart';
import 'storage_service.dart';
import 'connectivity_service.dart';
import 'ndfa_api_service.dart';
import 'upload_service.dart';
import 'api_constants.dart';

class SyncService extends GetxService {
  StorageService get _storage => Get.find<StorageService>();
  ConnectivityService get _connectivity => Get.find<ConnectivityService>();
  NdfaApiService get _api => Get.find<NdfaApiService>();
  UploadService get _upload => Get.find<UploadService>();

  final RxBool isSyncing = false.obs;
  final RxInt pendingCount = 0.obs;

  Future<SyncService> init() async {
    _updatePendingCount();
    ever(_connectivity.isOnline, (online) {
      if (online) syncPendingRecords();
    });
    return this;
  }

  void _updatePendingCount() {
    pendingCount.value = getPendingCallLogs().length;
  }

  List<CallLogModel> getPendingCallLogs() {
    return _storage
        .readList(ApiConstants.pendingCallLogsKey)
        .map((e) => CallLogModel.fromJson(e))
        .toList();
  }

  Future<void> queuePendingCallLog(CallLogModel log) async {
    final pending = getPendingCallLogs();
    final index = pending.indexWhere((l) => l.id == log.id);
    if (index >= 0) {
      pending[index] = log;
    } else {
      pending.add(log);
    }
    _storage.writeList(
      ApiConstants.pendingCallLogsKey,
      pending.map((e) => e.toJson()).toList(),
    );
    _updatePendingCount();
  }

  Future<void> removePendingCallLog(String id) async {
    final pending = getPendingCallLogs().where((l) => l.id != id).toList();
    _storage.writeList(
      ApiConstants.pendingCallLogsKey,
      pending.map((e) => e.toJson()).toList(),
    );
    _updatePendingCount();
  }

  Future<void> syncPendingRecords({bool silent = false}) async {
    if (!_connectivity.isOnline.value || isSyncing.value) return;

    final pendingCalls = getPendingCallLogs();
    if (pendingCalls.isEmpty) return;

    isSyncing.value = true;
    try {
      for (final log in pendingCalls) {
        final synced = await _syncCallLog(log);
        if (synced) await removePendingCallLog(log.id);
      }
      if (!silent) Get.snackbar('Sync', 'Pending call logs synced');
    } catch (e) {
      if (!silent) Get.snackbar('Sync Error', 'Some records pending: $e');
    } finally {
      isSyncing.value = false;
      _updatePendingCount();
    }
  }

  Future<bool> _syncCallLog(CallLogModel log) async {
    var updated = log;
    if (!log.hasOnlineRecording && log.localRecordingPath != null) {
      try {
        final url = await _upload.uploadVoiceFile(log.localRecordingPath!);
        if (url.contains('/uploads/')) {
          updated = log.copyWith(recordingUrl: url, localRecordingPath: null, synced: true);
        }
      } catch (_) {
        return false;
      }
    }
    try {
      await _api.syncCallLog(updated.toJson(forServer: true));
      _patchLocalCallLog(updated);
      return true;
    } catch (_) {
      return false;
    }
  }

  void _patchLocalCallLog(CallLogModel log) {
    final list = _storage.readList(ApiConstants.callLogsKey);
    final idx = list.indexWhere((e) => e['id'] == log.id);
    if (idx >= 0) {
      list[idx] = log.toJson();
      _storage.writeList(ApiConstants.callLogsKey, list);
    }
  }
}
