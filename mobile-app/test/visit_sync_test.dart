import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart' hide Response;
import 'package:nirmaldhara_micro_finance/app/data/models/enums/app_enums.dart';
import 'package:nirmaldhara_micro_finance/app/data/models/user_model.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/api_service.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/connectivity_service.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/storage_service.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/upload_service.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/visit_sync_service.dart';

class VisitMemoryStorage extends StorageService {
  String employee = 'E';
  final values = <String, dynamic>{};
  @override
  bool get isLoggedIn => true;
  @override
  UserModel? getUser() => UserModel(
      id: employee,
      name: employee,
      mobile: '9000000000',
      employeeId: employee,
      branch: 'Office',
      role: UserRole.fieldOfficer,
      token: 'session');
  @override
  List<Map<String, dynamic>> readList(String key) =>
      ((values[key] ?? []) as List)
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
  @override
  Future<void> writeListDurable(
      String key, List<Map<String, dynamic>> items) async {
    values[key] = jsonDecode(jsonEncode(items));
  }
}

class VisitHttp extends ApiService {
  bool failCompletion = true;
  int completedCalls = 0;
  @override
  Future<Response> post(String path,
      {dynamic data, Map<String, dynamic>? queryParameters}) async {
    if (path.endsWith('/complete')) {
      completedCalls++;
      if (failCompletion) throw Exception('Network unavailable');
    }
    return Response(requestOptions: RequestOptions(path: path), data: {
      'data': {'status': path.endsWith('/start') ? 'in_progress' : 'completed'}
    });
  }
}

class VisitUploads extends UploadService {
  int uploads = 0;
  Map<String, dynamic>? metadata;
  @override
  Future<String?> uploadPlainFile(String? path,
      {String type = 'photo',
      double? latitude,
      double? longitude,
      double? accuracy,
      String? capturedAt}) async {
    uploads++;
    metadata = {
      'latitude': latitude,
      'longitude': longitude,
      'accuracy': accuracy,
      'capturedAt': capturedAt,
      'type': type,
    };
    return '/uploads/ONE_visit.jpg';
  }
}

void main() {
  tearDown(() => Get.reset());
  test(
      'offline report persists, retries its uploaded photo once and stays employee scoped',
      () async {
    final storage = VisitMemoryStorage(),
        http = VisitHttp(),
        uploads = VisitUploads();
    final connection = ConnectivityService();
    Get.put<StorageService>(storage);
    Get.put<ApiService>(http);
    Get.put<UploadService>(uploads);
    Get.put<ConnectivityService>(connection);
    final sync = VisitSyncService();
    connection.isOnline.value = false;
    await sync.enqueue({
      'visitId': 'V',
      'photoPath': 'missing-local-test-photo.jpg',
      'position': {
        'lat': 26.7,
        'lng': 83.3,
        'accuracy': 9.5,
        'capturedAt': '2026-10-29T06:00:00.000Z'
      },
      'payload': {'discussion': 'Talked with customer'}
    });
    await sync.sync();
    expect(sync.pending, hasLength(1));
    expect(uploads.uploads, 0);
    storage.employee = 'OTHER';
    expect(sync.pending, isEmpty);
    await sync.sync();
    expect(http.completedCalls, 0);
    storage.employee = 'E';
    connection.isOnline.value = true;
    await sync.sync();
    expect(sync.pending, hasLength(1));
    expect(sync.pending.first['lastError'], contains('Network unavailable'));
    expect(uploads.uploads, 1);
    http.failCompletion = false;
    await sync.sync();
    expect(sync.pending, isEmpty);
    expect(uploads.uploads, 1);
    expect(uploads.metadata, {
      'latitude': 26.7,
      'longitude': 83.3,
      'accuracy': 9.5,
      'capturedAt': '2026-10-29T06:00:00.000Z',
      'type': 'visit_photo',
    });
    expect(http.completedCalls, 2);
  });
}
