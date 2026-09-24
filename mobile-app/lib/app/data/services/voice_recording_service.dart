import 'dart:io';

import 'package:get/get.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

/// Long-form call recording (up to ~15 min) with Android foreground-friendly settings.
class VoiceRecordingService extends GetxService {
  final AudioRecorder _recorder = AudioRecorder();
  String? _currentPath;
  final isRecording = false.obs;

  static const Duration maxRecordingDuration = Duration(minutes: 15);

  Future<bool> _requestPermission() async {
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  RecordConfig _buildConfig() {
    if (Platform.isAndroid) {
      return const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 44100,
        numChannels: 1,
        androidConfig: AndroidRecordConfig(
          audioSource: AndroidAudioSource.voiceCommunication,
          manageBluetooth: true,
        ),
      );
    }
    return const RecordConfig(
      encoder: AudioEncoder.aacLc,
      bitRate: 64000,
      sampleRate: 44100,
      numChannels: 1,
    );
  }

  Future<bool> startRecording() async {
    if (!await _requestPermission()) {
      Get.snackbar('Microphone', 'Permission denied');
      return false;
    }
    try {
      if (await _recorder.isRecording()) {
        await _recorder.stop();
      }
      final dir = await getApplicationDocumentsDirectory();
      _currentPath = '${dir.path}/call_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(_buildConfig(), path: _currentPath!);
      isRecording.value = true;
      return true;
    } catch (_) {
      isRecording.value = false;
      _currentPath = null;
      return false;
    }
  }

  Future<String?> stopRecording() async {
    try {
      final path = await _recorder.stop();
      isRecording.value = false;
      return path ?? _currentPath;
    } catch (_) {
      isRecording.value = false;
      return _currentPath;
    }
  }

  Future<void> cancelRecording() async {
    try {
      await _recorder.stop();
    } catch (_) {}
    isRecording.value = false;
    _currentPath = null;
  }

  @override
  void onClose() {
    _recorder.dispose();
    super.onClose();
  }
}
