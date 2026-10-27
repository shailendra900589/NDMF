import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart' hide Response;
import 'package:nirmaldhara_micro_finance/app/data/models/user_model.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/api_service.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/storage_service.dart';
import 'package:nirmaldhara_micro_finance/app/data/services/remote_api_service.dart';

class LoginStorage extends StorageService {
  String? token = 'old';
  UserModel? saved;
  int clears = 0;
  @override
  String? getToken() => token;
  @override
  void clearAuthSession() {
    clears++;
    token = null;
    saved = null;
  }

  @override
  void saveUser(UserModel user) {
    saved = user;
    token = user.token;
  }

  @override
  UserModel? getUser() => saved;
}

class LoginAdapter implements HttpClientAdapter {
  int calls = 0;
  bool badCredentials = false;
  bool alwaysOffline = false;
  final headers = <String?>[];
  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    calls++;
    headers.add(options.headers['Authorization']?.toString());
    if (badCredentials)
      return ResponseBody.fromString(
          '{"success":false,"message":"Invalid Login ID or password"}', 401,
          headers: {
            Headers.contentTypeHeader: ['application/json']
          });
    if (calls == 1 || alwaysOffline)
      throw DioException(
          requestOptions: options, type: DioExceptionType.connectionError);
    return ResponseBody.fromString(
        '{"success":true,"data":{"id":"M","name":"Manager","role":"branchManager","token":"new-session"}}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json']
        });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  tearDown(() => Get.reset());
  test(
      'a temporary login connection failure retries once without extra profile dependency',
      () async {
    final storage = LoginStorage(), adapter = LoginAdapter();
    Get.put<StorageService>(storage);
    final dio = Dio(BaseOptions(baseUrl: 'https://fixture.invalid'))
      ..httpClientAdapter = adapter;
    final api = await ApiService(client: dio).init();
    Get.put<ApiService>(api);
    final user = await RemoteApiService().login('MANAGER', 'fixture-pass');
    expect(user?.id, 'M');
    expect(storage.token, 'new-session');
    expect(adapter.calls, 2);
    expect(adapter.headers, [null, null]);
    expect(storage.clears, 0);
  });
  test('invalid credentials do not retry or clear another valid session',
      () async {
    final storage = LoginStorage(),
        adapter = LoginAdapter()..badCredentials = true;
    Get.put<StorageService>(storage);
    final dio = Dio(BaseOptions(baseUrl: 'https://fixture.invalid'))
      ..httpClientAdapter = adapter;
    final api = await ApiService(client: dio).init();
    await expectLater(
        api.post('/auth/login', data: {'loginId': 'M', 'password': 'wrong'}),
        throwsException);
    expect(adapter.calls, 1);
    expect(storage.clears, 0);
  });
  test('checkout writes are never automatically retried on connection failure',
      () async {
    final storage = LoginStorage(),
        adapter = LoginAdapter()..alwaysOffline = true;
    Get.put<StorageService>(storage);
    final dio = Dio(BaseOptions(baseUrl: 'https://fixture.invalid'))
      ..httpClientAdapter = adapter;
    final api = await ApiService(client: dio).init();
    await expectLater(
        api.post('/attendance/check-out', data: {'lat': 26.7, 'lng': 83.4}),
        throwsException);
    expect(adapter.calls, 1);
  });
}
