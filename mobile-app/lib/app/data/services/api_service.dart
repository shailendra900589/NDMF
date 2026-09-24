import 'package:dio/dio.dart';
import 'package:get/get.dart' hide Response, FormData;
import '../../routes/app_routes.dart';
import '../../utils/api_errors.dart';
import 'api_constants.dart';
import 'storage_service.dart';

class ApiService extends GetxService {
  late Dio _dio;
  StorageService get _storage => Get.find<StorageService>();

  Future<ApiService> init() async {
    _dio = Dio(BaseOptions(
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
        if (token != null && token.isNotEmpty) {
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
          if (_storage.getToken()?.isNotEmpty ?? false) {
            _storage.clearAuthSession();
            if (Get.currentRoute != AppRoutes.login && Get.currentRoute != AppRoutes.splash) {
              Get.offAllNamed(AppRoutes.login);
            }
          }
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
  }

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      return await _dio.get(path, queryParameters: queryParameters);
    } on DioException catch (e) {
      _handleError(e);
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Response> post(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    try {
      return await _dio.post(path, data: data, queryParameters: queryParameters);
    } on DioException catch (e) {
      if (!path.contains('/auth/login') && !path.contains('/auth/otp')) {
        _handleError(e);
      }
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Response> put(String path, {dynamic data}) async {
    try {
      return await _dio.put(path, data: data);
    } on DioException catch (e) {
      _handleError(e);
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Response> delete(String path, {dynamic data}) async {
    try {
      return await _dio.delete(path, data: data);
    } on DioException catch (e) {
      _handleError(e);
      throw Exception(apiErrorMessage(e));
    }
  }

  Future<Response> upload(String path, FormData formData) async {
    return _dio.post(
      path,
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
  }
}
