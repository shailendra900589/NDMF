import 'dart:async';
import 'dart:io';
import 'package:get/get.dart';
import 'api_service.dart';
import 'connectivity_service.dart';
import 'storage_service.dart';
import 'upload_service.dart';
import '../../utils/api_errors.dart';

/// Queue belongs to the signed-in employee. Acknowledged reports are removed individually.
class VisitSyncService extends GetxService {
  bool _syncing = false;
  Timer? _timer;
  Worker? _connection;
  StorageService get _storage => Get.find<StorageService>();
  String get queueKey =>
      'visit_queue_${_storage.getUser()?.id ?? 'signed_out'}';
  String get cacheKey =>
      'visit_cache_${_storage.getUser()?.id ?? 'signed_out'}';
  List<Map<String, dynamic>> get pending => _storage.readList(queueKey);

  @override
  void onInit() {
    super.onInit();
    _connection = ever(Get.find<ConnectivityService>().isOnline, (online) {
      if (online) unawaited(sync());
    });
    _timer =
        Timer.periodic(const Duration(seconds: 45), (_) => unawaited(sync()));
  }

  Future<void> enqueue(Map<String, dynamic> item) async {
    final items = pending.where((e) => e['visitId'] != item['visitId']).toList()
      ..add(item);
    await _storage.writeListDurable(queueKey, items);
  }

  Future<void> sync() async {
    if (_syncing ||
        !_storage.isLoggedIn ||
        !Get.find<ConnectivityService>().isOnline.value) {
      return;
    }
    _syncing = true;
    final key = queueKey;
    try {
      for (final item in _storage.readList(key)) {
        if (queueKey != key) break;
        try {
          final api = Get.find<ApiService>();
          final payload = Map<String, dynamic>.from(item['payload'] as Map);
          final response = await api.post(
              '/workspace/visits/${item['visitId']}/start',
              data: {'position': item['position']});
          if (queueKey != key) break;
          if (response.data['data']['status'] != 'completed') {
            final photo = item['uploadedPhoto'] ??
                await Get.find<UploadService>().uploadPlainFile(
                    item['photoPath'] as String,
                    type: 'visit_photo',
                    latitude: (item['position']?['lat'] as num?)?.toDouble(),
                    longitude: (item['position']?['lng'] as num?)?.toDouble(),
                    accuracy:
                        (item['position']?['accuracy'] as num?)?.toDouble(),
                    capturedAt: item['position']?['capturedAt']?.toString());
            item['uploadedPhoto'] = photo;
            if (queueKey != key) break;
            final updated = _storage
                .readList(key)
                .map((e) => e['visitId'] == item['visitId'] ? item : e)
                .toList();
            await _storage.writeListDurable(key, updated);
            await api.post('/workspace/visits/${item['visitId']}/complete',
                data: {
                  ...payload,
                  'photo': photo,
                  'photoGps': item['position']
                });
          }
          await _storage.writeListDurable(
              key,
              _storage
                  .readList(key)
                  .where((e) => e['visitId'] != item['visitId'])
                  .toList());
          try {
            await File(item['photoPath'] as String).delete();
          } catch (_) {}
        } catch (e) {
          final updated = _storage
              .readList(key)
              .map((p) => p['visitId'] == item['visitId']
                  ? {...p, 'lastError': apiErrorMessage(e)}
                  : p)
              .toList();
          await _storage.writeListDurable(key, updated);
        }
      }
    } finally {
      _syncing = false;
    }
  }

  @override
  void onClose() {
    _timer?.cancel();
    _connection?.dispose();
    super.onClose();
  }
}
