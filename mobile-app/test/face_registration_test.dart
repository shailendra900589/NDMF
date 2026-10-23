import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart' hide Response;
import 'package:nirmaldhara_micro_finance/app/data/models/user_model.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/api_service.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/remote_api_service.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/storage_service.dart';

class MemoryStorage extends StorageService {
  UserModel? user;
  @override
  String? getToken() => 'existing-session';
  @override
  void saveUser(UserModel value) {
    user = value;
  }
}

class FakeHttp extends ApiService {
  bool confirmed = true;
  Map<String, dynamic>? submitted;
  @override
  Future<Response> put(String path, {dynamic data}) async {
    submitted = Map<String, dynamic>.from(data as Map);
    return Response(requestOptions: RequestOptions(path: path), data: {
      'success': true,
      'data': {
        'id': 'EMP',
        'name': 'Employee',
        'role': 'fieldOfficer',
        'faceEnrollmentComplete': confirmed
      }
    });
  }
}

void main() {
  tearDown(() => Get.reset());
  test(
      'confirmed save refreshes cached registration without losing the session',
      () async {
    final http = FakeHttp(), storage = MemoryStorage();
    Get.put<ApiService>(http);
    Get.put<StorageService>(storage);
    final remote = RemoteApiService();
    await remote.saveFaceEnrollmentUrls(
        ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg']);
    expect(storage.user?.faceEnrollmentComplete, true);
    expect(storage.user?.token, 'existing-session');
    expect(http.submitted?['urls'], hasLength(3));
  });
  test('an unconfirmed server response never marks local registration complete',
      () async {
    final http = FakeHttp()..confirmed = false;
    final storage = MemoryStorage();
    Get.put<ApiService>(http);
    Get.put<StorageService>(storage);
    await expectLater(
        RemoteApiService().saveFaceEnrollmentUrls(
            ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg']),
        throwsException);
    expect(storage.user, isNull);
  });
}
