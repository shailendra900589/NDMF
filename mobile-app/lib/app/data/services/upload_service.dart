import 'dart:io';
import 'package:dio/dio.dart';
import 'package:get/get.dart' hide Response, FormData, MultipartFile;
import 'package:http_parser/http_parser.dart';
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

  /// Server DB stores `/uploads/...` (relative).
  static String normalizeUploadPath(String fileUrl) {
    final trimmed = fileUrl.trim();
    if (trimmed.isEmpty) return trimmed;
    final i = trimmed.indexOf('/uploads/');
    if (i >= 0) return trimmed.substring(i);
    return trimmed;
  }

  static const int minVoiceFileBytes = 800;

  String fullUrl(String path) {
    if (path.startsWith('http')) {
      final uploadsIndex = path.indexOf('/uploads/');
      if (uploadsIndex >= 0) return fullUrl(path.substring(uploadsIndex));
      return path;
    }
    return '$_serverOrigin$path';
  }

  Future<String> uploadGpsPhoto(GpsPhotoCapture photo,
      {String type = 'photo'}) async {
    if (photo.filePath.startsWith('http') ||
        photo.filePath.startsWith('/uploads')) {
      return fullUrl(photo.filePath);
    }
    final file = File(photo.filePath);
    if (!await file.exists())
      throw Exception('File not found: ${photo.filePath}');

    final formData = FormData.fromMap({
      'file':
          await MultipartFile.fromFile(photo.filePath, filename: 'photo.jpg'),
      'latitude': photo.latitude,
      'longitude': photo.longitude,
      'capturedAt': photo.capturedAt.toIso8601String(),
      'type': type,
    });

    final res = await _http.upload(ApiConstants.uploadSingle, formData);
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true)
      throw Exception(body['message'] ?? 'Upload failed');
    final data = body['data'] as Map<String, dynamic>;
    return fullUrl(data['fileUrl'] as String);
  }

  /// Returns relative `/uploads/...` path for DB storage; stream via [fullUrl].
  Future<String?> uploadVoiceFileWithRetry(String localPath,
      {int attempts = 3}) async {
    for (var i = 0; i < attempts; i++) {
      try {
        return await uploadVoiceFile(localPath);
      } catch (_) {
        if (i < attempts - 1) {
          await Future<void>.delayed(Duration(seconds: 2 * (i + 1)));
        }
      }
    }
    return null;
  }

  Future<String> uploadVoiceFile(String localPath) async {
    if (localPath.startsWith('/uploads')) return normalizeUploadPath(localPath);
    if (localPath.startsWith('http')) {
      return normalizeUploadPath(localPath);
    }
    final file = File(localPath);
    if (!await file.exists()) {
      throw Exception('Recording file missing on device');
    }
    final bytes = await file.length();
    if (bytes < minVoiceFileBytes) {
      throw Exception('Recording too short or empty ($bytes bytes)');
    }

    final isWav = localPath.toLowerCase().endsWith('.wav');
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        localPath,
        filename:
            'call_${DateTime.now().millisecondsSinceEpoch}.${isWav ? 'wav' : 'm4a'}',
        contentType: MediaType('audio', isWav ? 'wav' : 'mp4'),
      ),
      'type': 'voice',
    });

    final res = await _http.upload(ApiConstants.uploadSingle, formData);
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true)
      throw Exception(body['message'] ?? 'Upload failed');
    final data = body['data'] as Map<String, dynamic>;
    final url = data['fileUrl']?.toString() ?? '';
    if (!url.contains('/uploads/')) {
      throw Exception('Invalid upload response');
    }
    return normalizeUploadPath(url);
  }

  Future<String?> uploadPlainFile(String? path, {String type = 'photo'}) async {
    if (path == null || path.isEmpty) return null;
    if (path.startsWith('http') || path.startsWith('/uploads'))
      return fullUrl(path);

    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(path),
      'type': type,
    });
    final res = await _http.upload(ApiConstants.uploadSingle, formData);
    final body = res.data as Map<String, dynamic>;
    if (body['success'] != true) {
      throw Exception(body['message'] ?? 'Photo upload failed');
    }
    final data = body['data'] as Map<String, dynamic>;
    final url = data['fileUrl']?.toString() ?? '';
    if (!url.contains('/uploads/'))
      throw Exception('Server did not confirm the photo upload');
    return fullUrl(url);
  }
}
