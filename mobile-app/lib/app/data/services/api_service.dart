import 'package:dio/dio.dart';
import 'package:get/get.dart' hide Response, FormData;
import '../../utils/api_errors.dart';
import '../../widgets/session_expired_dialog.dart';
import 'api_constants.dart';
import 'storage_service.dart';
import '../../utils/session_policy.dart';

class ApiService extends GetxService {
  ApiService({Dio? client}) : _client = client;
  final Dio? _client;
  late Dio _dio;
  StorageService get _storage => Get.find<StorageService>();

  Future<ApiService> init() async {
    _dio = _client ??
        Dio(BaseOptions(
          baseUrl: ApiConstants.baseUrl,
          connectTimeout: ApiConstants.connectTimeout,
          receiveTimeout: ApiConstants.receiveTimeout,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _storage.getToken();
        if (options.path.contains('/auth/login') ||
            options.path.contains('/auth/otp/')) {
          options.headers.remove('Authorization');
        } else if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        _handleError(error);
        handler.next(error);
      },
    ));

    return this;
  }

  void _handleError(DioException error) {
    String message = 'Something went wrong';
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        message = 'Connection timeout. Please try again.';
        break;
      case DioExceptionType.connectionError:
        message = 'No internet connection.';
        break;
      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        final data = error.response?.data;
        if (data is Map && data['message'] != null) {
          message = data['message'];
        } else if (statusCode == 401) {
          message = apiErrorMessage(error);
        } else if (statusCode == 403) {
          message = 'Access denied.';
        } else if (statusCode == 404) {
          message = 'Resource not found.';
        } else if (statusCode == 500) {
          message = 'Server error. Please try later.';
        }
        break;
      default:
        message = error.message ?? 'Unknown error occurred';
    }
    if (Get.isLogEnable) {
      // ignore: avoid_print
      print('API Error: $message');
    }
    if (shouldExpireSession(
            error.response?.statusCode, error.requestOptions.path, message) &&
        isCurrentSessionRequest(
            error.requestOptions.headers['Authorization']?.toString(),
            _storage.getToken())) {
      _storage.clearAuthSession();
      showSessionExpiredDialog();
    }
  }

  Future<Response> get(String path,
      {Map<String, dynamic>? queryParameters}) async {
    try {
      return await _dio.get(path, queryParameters: queryParameters);
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Response> post(String path,
      {dynamic data, Map<String, dynamic>? queryParameters}) async {
    try {
      final authRequest = path.contains('/auth/login');
      for (var attempt = 0;; attempt++) {
        try {
          return await _dio.post(path,
              data: data, queryParameters: queryParameters);
        } on DioException catch (e) {
          if (!authRequest || attempt >= 1 || !isTransientConnectionError(e)) {
            rethrow;
          }
          await Future<void>.delayed(const Duration(milliseconds: 400));
        }
      }
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Response> put(String path, {dynamic data}) async {
    try {
      return await _dio.put(path, data: data);
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Response> delete(String path, {dynamic data}) async {
    try {
      return await _dio.delete(path, data: data);
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Response> upload(String path, FormData formData) async {
    try {
      return await _dio.post(
        path,
        data: formData,
        options: Options(
          contentType: 'multipart/form-data',
          sendTimeout: ApiConstants.uploadTimeout,
          receiveTimeout: ApiConstants.uploadTimeout,
        ),
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e));
    }
  }
}
