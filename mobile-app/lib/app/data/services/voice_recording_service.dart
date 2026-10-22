import 'dart:io';

import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

/// Long-form call recording (up to 60 min). Android uses a foreground mic service
/// so recording continues while the system dialer is open.
class VoiceRecordingService extends GetxService {
  static const _recordingChannel = MethodChannel('com.nirmaldhara.microfinance/call_recording');
  final AudioRecorder _recorder = AudioRecorder();
  bool _nativeSession = false;
  String? _currentPath;
  final List<String> _segmentPaths = [];
  int _segmentIndex = 0;
  final isRecording = false.obs;

  static const Duration maxRecordingDuration = Duration(minutes: 60);
  static const int minValidFileBytes = 800;

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
    // Prefer MIC + normal mode during PSTN calls; voiceCommunication often records silence.
    return [
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 128000,
        sampleRate: 44100,
        numChannels: 1,
        androidConfig: AndroidRecordConfig(
          audioSource: AndroidAudioSource.mic,
          audioManagerMode: AudioManagerMode.modeNormal,
          manageBluetooth: true,
          speakerphone: true,
        ),
      ),
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 128000,
        sampleRate: 44100,
        numChannels: 1,
        androidConfig: AndroidRecordConfig(
          audioSource: AndroidAudioSource.voiceRecognition,
          audioManagerMode: AudioManagerMode.modeNormal,
          manageBluetooth: true,
          speakerphone: true,
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
          audioManagerMode: AudioManagerMode.modeNormal,
          manageBluetooth: true,
          speakerphone: true,
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
          speakerphone: true,
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

  Future<bool> _startNativeRecording() async {
    if (!Platform.isAndroid) return false;
    try {
      final started = await _recordingChannel.invokeMethod<bool>('start');
      if (started != true) return false;
      for (var i = 0; i < 20; i++) {
        final active = await _recordingChannel.invokeMethod<bool>('isRecording');
        if (active == true) {
          _nativeSession = true;
          isRecording.value = true;
          _currentPath = 'native';
          return true;
        }
        await Future<void>.delayed(const Duration(milliseconds: 100));
      }
    } catch (_) {}
    return false;
  }

  Future<bool> startRecording() async {
    if (!await _requestPermission()) {
      Get.snackbar('Microphone', 'Permission denied');
      return false;
    }
    if (await _startNativeRecording()) return true;
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
    if (_nativeSession) {
      try {
        final active = await _recordingChannel.invokeMethod<bool>('isRecording');
        if (active == true) {
          isRecording.value = true;
          return;
        }
      } catch (_) {}
      _nativeSession = false;
      isRecording.value = false;
    }
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
      var bytesPerSecond = 32000;
      if (path.toLowerCase().endsWith('.wav') && bytes > 44) {
        final header = await file.openRead(0, 44).fold<List<int>>(
          <int>[],
          (chunk, data) => chunk..addAll(data),
        );
        if (header.length >= 36) {
          final rate = header[24] | (header[25] << 8) | (header[26] << 16) | (header[27] << 24);
          final channels = header[22] | (header[23] << 8);
          final bits = header[34] | (header[35] << 8);
          final width = bits <= 0 ? 16 : bits;
          final ch = channels <= 0 ? 1 : channels;
          if (rate > 0) bytesPerSecond = rate * ch * (width ~/ 8);
        }
      }
      final pcm = path.toLowerCase().endsWith('.wav') && bytes > 44 ? bytes - 44 : bytes;
      final estimated = (pcm / bytesPerSecond).round().clamp(0, 60 * 60);
      if (estimated <= 0) return fallbackSeconds;
      return estimated;
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

  Future<bool> isValidRecordingFile(String? path) async {
    if (path == null || path.isEmpty) return false;
    try {
      final f = File(path);
      if (!await f.exists()) return false;
      return await f.length() >= minValidFileBytes;
    } catch (_) {
      return false;
    }
  }

  Future<String?> stopRecording() async {
    if (_nativeSession) {
      _nativeSession = false;
      isRecording.value = false;
      try {
        final path = await _recordingChannel.invokeMethod<String>('stop');
        _currentPath = null;
        _segmentPaths.clear();
        if (path != null && path.isNotEmpty && await isValidRecordingFile(path)) {
          return path;
        }
      } catch (_) {}
      return null;
    }
    try {
      String? stopped;
      if (await _recorder.isRecording()) {
        stopped = await _recorder.stop();
      }
      isRecording.value = false;
      await Future<void>.delayed(const Duration(milliseconds: 450));
      final best = await _bestSegmentPath(stopped ?? _currentPath);
      if (best != null && !await isValidRecordingFile(best)) {
        _segmentPaths.clear();
        _currentPath = null;
        return null;
      }
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
    if (_nativeSession) {
      _nativeSession = false;
      try {
        await _recordingChannel.invokeMethod<String>('stop');
      } catch (_) {}
    }
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
