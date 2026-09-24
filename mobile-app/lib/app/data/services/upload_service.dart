import 'dart:io';
import 'package:dio/dio.dart';
import 'package:get/get.dart' hide Response, FormData, MultipartFile;
import '../models/customer_listing_model.dart';
import 'api_constants.dart';
import 'api_service.dart';

/// Photos aur voice files backend par upload karta hai.
class UploadService extends GetxService {
  ApiService get _http => Get.find<ApiService>();

  String get _serverOrigin {
    final base = ApiConstants.baseUrl;
    return base.replaceAll('/api/v1', '');
  }

  String fullUrl(String path) {
    if (path.startsWith('http')) {
      final uploadsIndex = path.indexOf('/uploads/');
      if (uploadsIndex >= 0) return fullUrl(path.substring(uploadsIndex));
      return path;
    }
    return '$_serverOrigin$path';
  }

  Future<String> uploadGpsPhoto(GpsPhotoCapture photo, {String type = 'photo'}) async {
    if (photo.filePath.startsWith('http') || photo.filePath.startsWith('/uploads')) {
      return fullUrl(photo.filePath);
    }
    final file = File(photo.filePath);
    if (!await file.exists()) throw Exception('File not found: ${photo.filePath}');

    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(photo.filePath, filename: 'photo.jpg'),
      'latitude': photo.latitude,
      'longitude': photo.longitude,
      'capturedAt': photo.capturedAt.toIso8601String(),
      'type': type,
    });

    final res = await _http.upload(ApiConstants.uploadSingle, formData);
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true) throw Exception(body['message'] ?? 'Upload failed');
    final data = body['data'] as Map<String, dynamic>;
    return fullUrl(data['fileUrl'] as String);
  }

  /// Returns relative `/uploads/...` path for DB storage; stream via [fullUrl].
  Future<String?> uploadVoiceFileWithRetry(String localPath, {int attempts = 3}) async {
    Object? lastError;
    for (var i = 0; i < attempts; i++) {
      try {
        return await uploadVoiceFile(localPath);
      } catch (e) {
        lastError = e;
        if (i < attempts - 1) {
          await Future<void>.delayed(Duration(seconds: 2 * (i + 1)));
        }
      }
    }
    if (lastError != null) throw lastError!;
    return null;
  }

  Future<String> uploadVoiceFile(String localPath) async {
    if (localPath.startsWith('/uploads')) return localPath;
    if (localPath.startsWith('http')) {
      final i = localPath.indexOf('/uploads/');
      return i >= 0 ? localPath.substring(i) : localPath;
    }
    final file = File(localPath);
    if (!await file.exists()) return localPath;

    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(localPath, filename: 'voice.m4a'),
      'type': 'voice',
    });

    final res = await _http.upload(ApiConstants.uploadSingle, formData);
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true) throw Exception(body['message'] ?? 'Upload failed');
    final data = body['data'] as Map<String, dynamic>;
    return data['fileUrl'] as String;
  }

  Future<String?> uploadPlainFile(String? path, {String type = 'photo'}) async {
    if (path == null || path.isEmpty) return null;
    if (path.startsWith('http') || path.startsWith('/uploads')) return fullUrl(path);

    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(path),
      'type': type,
    });
    final res = await _http.upload(ApiConstants.uploadSingle, formData);
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true) return path;
    final data = body['data'] as Map<String, dynamic>;
    return fullUrl(data['fileUrl'] as String);
  }
}
