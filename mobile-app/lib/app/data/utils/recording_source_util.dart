import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:get/get.dart';
import '../services/upload_service.dart';

/// Resolves recording path for local file vs online server stream.
class RecordingSourceUtil {
  RecordingSourceUtil._();

  static bool isServerRecording(String? path) =>
      path != null && path.contains('/uploads/');

  static bool isLocalRecording(String? path) {
    if (path == null || path.isEmpty) return false;
    if (isServerRecording(path)) return false;
    if (path.startsWith('http')) return false;
    return path.contains('/') || path.contains('\\');
  }

  static bool canPlay({String? recordingUrl, String? localRecordingPath}) =>
      isServerRecording(recordingUrl) ||
      isLocalRecording(localRecordingPath) ||
      isLocalRecording(recordingUrl) ||
      (recordingUrl != null && recordingUrl.startsWith('http'));

  static String? serverStreamUrl(String? recordingUrl) {
    if (recordingUrl == null || recordingUrl.isEmpty) return null;
    if (isServerRecording(recordingUrl)) {
      return Get.find<UploadService>().fullUrl(recordingUrl);
    }
    if (recordingUrl.startsWith('http')) {
      final i = recordingUrl.indexOf('/uploads/');
      if (i >= 0) return Get.find<UploadService>().fullUrl(recordingUrl.substring(i));
      return recordingUrl;
    }
    return null;
  }

  static Future<Source?> resolveSource({
    String? recordingUrl,
    String? localRecordingPath,
  }) async {
    final local = localRecordingPath ?? (isLocalRecording(recordingUrl) ? recordingUrl : null);
    if (local != null && await File(local).exists()) {
      return DeviceFileSource(local);
    }

    final stream = serverStreamUrl(recordingUrl);
    if (stream != null) return UrlSource(stream);

    return null;
  }
}
