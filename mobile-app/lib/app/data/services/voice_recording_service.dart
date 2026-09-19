import 'package:get/get.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

class VoiceRecordingService extends GetxService {
  final AudioRecorder _recorder = AudioRecorder();
  String? _currentPath;
  final isRecording = false.obs;

  Future<bool> _requestPermission() async {
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  Future<bool> startRecording() async {
    if (!await _requestPermission()) {
      Get.snackbar('Microphone', 'Permission denied');
      return false;
    }
    try {
      final dir = await getApplicationDocumentsDirectory();
      _currentPath = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: _currentPath!);
      isRecording.value = true;
      return true;
    } catch (_) {
      isRecording.value = false;
      _currentPath = null;
      return false;
    }
  }

  Future<String?> stopRecording() async {
    final path = await _recorder.stop();
    isRecording.value = false;
    return path ?? _currentPath;
  }

  Future<void> cancelRecording() async {
    await _recorder.stop();
    isRecording.value = false;
    _currentPath = null;
  }

  @override
  void onClose() {
    _recorder.dispose();
    super.onClose();
  }
}
