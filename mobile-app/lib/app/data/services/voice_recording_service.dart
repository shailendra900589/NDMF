import 'dart:io';

import 'package:get/get.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

/// Long-form call recording (up to ~15 min) with Android tuning + segment keepalive.
class VoiceRecordingService extends GetxService {
  final AudioRecorder _recorder = AudioRecorder();
  String? _currentPath;
  final List<String> _segmentPaths = [];
  int _segmentIndex = 0;
  final isRecording = false.obs;

  static const Duration maxRecordingDuration = Duration(minutes: 15);

  bool get hasActiveSession => _segmentPaths.isNotEmpty || isRecording.value;

  Future<bool> _requestPermission() async {
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  List<RecordConfig> _configCandidates() {
    if (!Platform.isAndroid) {
      return [
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 44100,
          numChannels: 1,
        ),
      ];
    }
    return [
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 44100,
        numChannels: 1,
        androidConfig: AndroidRecordConfig(
          useLegacy: true,
          audioSource: AndroidAudioSource.voiceCommunication,
          audioManagerMode: AudioManagerMode.modeInCommunication,
          manageBluetooth: true,
          speakerphone: false,
        ),
      ),
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 44100,
        numChannels: 1,
        androidConfig: AndroidRecordConfig(
          useLegacy: true,
          audioSource: AndroidAudioSource.mic,
          audioManagerMode: AudioManagerMode.modeInCommunication,
          manageBluetooth: true,
        ),
      ),
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 48000,
        sampleRate: 44100,
        numChannels: 1,
        androidConfig: AndroidRecordConfig(
          audioSource: AndroidAudioSource.voiceRecognition,
          audioManagerMode: AudioManagerMode.modeNormal,
          manageBluetooth: true,
        ),
      ),
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 44100,
        numChannels: 1,
        androidConfig: AndroidRecordConfig(
          useLegacy: true,
          audioSource: AndroidAudioSource.mic,
          manageBluetooth: true,
        ),
      ),
    ];
  }

  Future<bool> _startWithConfig(RecordConfig config, String path) async {
    await _recorder.start(config, path: path);
    _currentPath = path;
    if (!_segmentPaths.contains(path)) _segmentPaths.add(path);
    isRecording.value = true;
    return true;
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
      _segmentPaths.clear();
      _segmentIndex = 0;
      final dir = await getApplicationDocumentsDirectory();
      final path = '${dir.path}/call_${DateTime.now().millisecondsSinceEpoch}.m4a';

      for (final config in _configCandidates()) {
        try {
          return await _startWithConfig(config, path);
        } catch (_) {}
      }
      isRecording.value = false;
      _currentPath = null;
      return false;
    } catch (_) {
      isRecording.value = false;
      _currentPath = null;
      return false;
    }
  }

  /// If OS pauses mic during phone UI, start a new segment on the same call.
  Future<void> maintainRecordingDuringCall() async {
    if (!Platform.isAndroid) return;
    try {
      if (await _recorder.isRecording()) return;
      final dir = await getApplicationDocumentsDirectory();
      _segmentIndex++;
      final path = '${dir.path}/call_${DateTime.now().millisecondsSinceEpoch}_p$_segmentIndex.m4a';
      for (final config in _configCandidates()) {
        try {
          await _startWithConfig(config, path);
          return;
        } catch (_) {}
      }
    } catch (_) {}
  }

  Future<int> estimateSecondsFromFile(String path, int fallbackSeconds) async {
    try {
      final file = File(path);
      if (!await file.exists()) return fallbackSeconds;
      final bytes = await file.length();
      final estimated = (bytes / 8000).round();
      return estimated > fallbackSeconds ? estimated : fallbackSeconds;
    } catch (_) {
      return fallbackSeconds;
    }
  }

  Future<String?> _bestSegmentPath(String? lastStopped) async {
    String? best = lastStopped;
    var bestLen = 0;
    if (best != null && await File(best).exists()) {
      bestLen = await File(best).length();
    }
    for (final p in _segmentPaths) {
      final f = File(p);
      if (!await f.exists()) continue;
      final len = await f.length();
      if (len > bestLen) {
        bestLen = len;
        best = p;
      }
    }
    return best;
  }

  Future<String?> stopRecording() async {
    try {
      String? stopped;
      if (await _recorder.isRecording()) {
        stopped = await _recorder.stop();
      }
      isRecording.value = false;
      final best = await _bestSegmentPath(stopped ?? _currentPath);
      _segmentPaths.clear();
      _currentPath = null;
      return best;
    } catch (_) {
      isRecording.value = false;
      final best = await _bestSegmentPath(_currentPath);
      _segmentPaths.clear();
      _currentPath = null;
      return best;
    }
  }

  Future<void> cancelRecording() async {
    try {
      if (await _recorder.isRecording()) await _recorder.stop();
    } catch (_) {}
    isRecording.value = false;
    _currentPath = null;
    _segmentPaths.clear();
  }

  @override
  void onClose() {
    _recorder.dispose();
    super.onClose();
  }
}
