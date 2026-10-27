import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

/// User-facing API error text (no raw DioException dumps).
bool isTransientConnectionError(DioException error) => const {
      DioExceptionType.connectionTimeout,
      DioExceptionType.connectionError,
      DioExceptionType.receiveTimeout,
      DioExceptionType.sendTimeout,
    }.contains(error.type);

String apiErrorMessage(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['message'] != null) {
      return data['message'].toString();
    }
    final code = error.response?.statusCode;
    if (code == 401) {
      return 'Session expired. Please sign in again.';
    }
    if (code == 403) {
      return 'You do not have permission for this action.';
    }
    if (code == 502 || code == 503 || code == 504)
      return 'Server is temporarily unavailable. Please try again shortly.';
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Connection timeout. Check internet and try again.';
      case DioExceptionType.connectionError:
        if (kIsWeb) {
          return 'Web browser blocked the API (CORS). Deploy latest API on server, '
              'or run mobile-app/scripts/run_web.ps1 for local testing.';
        }
        return 'Cannot reach server. Check internet and try again.';
      case DioExceptionType.badCertificate:
        return 'Could not establish a secure connection. Check your phone date and time and try again.';
      default:
        return 'Request failed. Please try again.';
    }
  }
  final raw = error.toString();
  if (raw.startsWith('Exception: ')) {
    return raw.replaceFirst('Exception: ', '');
  }
  return raw;
}

bool isSessionExpiredError(Object error) {
  if (error is DioException && error.response?.statusCode == 401) return true;
  final msg = apiErrorMessage(error).toLowerCase();
  return msg.contains('session expired') ||
      msg.contains('login required') ||
      msg.contains('invalid or expired token');
}
