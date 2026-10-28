import 'dart:async';
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:path_provider/path_provider.dart';
import '../utils/auto_face_capture.dart';
import '../utils/camera_frame.dart';
import 'live_face_camera.dart';

/// Automatic, in-app stream capture. No gallery, shutter or countdown.
class QuickFaceCamera extends StatefulWidget {
  const QuickFaceCamera({super.key});
  @override
  State<QuickFaceCamera> createState() => _QuickFaceCameraState();
}

class _QuickFaceCameraState extends State<QuickFaceCamera>
    with WidgetsBindingObserver {
  CameraController? _camera;
  final _detector = FaceDetector(
      options: FaceDetectorOptions(
          enableClassification: true,
          enableTracking: true,
          performanceMode: FaceDetectorMode.fast,
          minFaceSize: 0.20));
  final _sequence = AutoFaceCapture();
  bool _processing = false, _delivered = false, _finishing = false;
  String _message = 'Look at the camera';
  String? _error, _neutral, _action;
  Timer? _timeout;
  DateTime _last = DateTime.fromMillisecondsSinceEpoch(0);
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _open();
  }

  Future<void> _open() async {
    try {
      final front = (await availableCameras())
          .where((c) => c.lensDirection == CameraLensDirection.front)
          .firstOrNull;
      if (front == null) throw StateError('A front camera is required');
      final camera = CameraController(front, ResolutionPreset.medium,
          enableAudio: false,
          imageFormatGroup: Platform.isAndroid
              ? ImageFormatGroup.yuv420
              : ImageFormatGroup.bgra8888);
      _camera = camera;
      await camera.initialize();
      if (!mounted) return;
      await camera.startImageStream(_frame);
      _timeout = Timer(const Duration(seconds: 20), () {
        if (mounted && !_finishing)
          setState(() => _error =
              'Could not capture a clear blink. Check lighting, remove dark glasses and try again.');
      });
      setState(() {});
    } catch (_) {
      if (mounted)
        setState(() => _error =
            'Camera could not start. Allow camera permission and retry.');
    }
  }

  int _rotation() {
    final camera = _camera!;
    if (Platform.isIOS) return camera.description.sensorOrientation;
    const orientations = {
      DeviceOrientation.portraitUp: 0,
      DeviceOrientation.landscapeLeft: 90,
      DeviceOrientation.portraitDown: 180,
      DeviceOrientation.landscapeRight: 270
    };
    return (camera.description.sensorOrientation +
            (orientations[camera.value.deviceOrientation] ?? 0)) %
        360;
  }

  Future<void> _clearFrames() async {
    for (final path in [_neutral, _action]) {
      if (path != null) {
        try {
          await File(path).delete();
        } catch (_) {}
      }
    }
    _neutral = null;
    _action = null;
  }

  Future<String> _save(Map<String, dynamic> data, String kind) async {
    final jpeg = await compute(encodeFaceFrame, data);
    final dir = await getTemporaryDirectory();
    final path =
        '${dir.path}/live_${DateTime.now().microsecondsSinceEpoch}_$kind.jpg';
    await File(path).writeAsBytes(jpeg, flush: true);
    return path;
  }

  Future<void> _frame(CameraImage frame) async {
    final now = DateTime.now();
    if (_processing ||
        _finishing ||
        _error != null ||
        !mounted ||
        now.difference(_last).inMilliseconds < 90) return;
    _processing = true;
    _last = now;
    try {
      final rotation = _rotation();
      final bytes = Platform.isAndroid
          ? packNv21(
              frame.width,
              frame.height,
              frame.planes.map((p) => p.bytes).toList(),
              frame.planes.map((p) => p.bytesPerRow).toList(),
              frame.planes.map((p) => p.bytesPerPixel ?? 1).toList())
          : Uint8List.fromList(frame.planes.first.bytes);
      final image = InputImage.fromBytes(
          bytes: bytes,
          metadata: InputImageMetadata(
              size: Size(frame.width.toDouble(), frame.height.toDouble()),
              rotation: InputImageRotationValue.fromRawValue(rotation)!,
              format: Platform.isAndroid
                  ? InputImageFormat.nv21
                  : InputImageFormat.bgra8888,
              bytesPerRow: Platform.isAndroid
                  ? frame.width
                  : frame.planes.first.bytesPerRow));
      final faces = await _detector.processImage(image);
      if (!mounted || _error != null) return;
      final face = faces.length == 1 ? faces.first : null;
      final centered = face != null &&
          (face.headEulerAngleY ?? 90).abs() < 15 &&
          (face.headEulerAngleZ ?? 90).abs() < 15 &&
          face.boundingBox.shortestSide >= 100;
      final before = _sequence.step;
      final step = _sequence.observe(
          singleCenteredFace: centered,
          leftEye: face?.leftEyeOpenProbability ?? double.nan,
          rightEye: face?.rightEyeOpenProbability ?? double.nan,
          trackingId: face?.trackingId,
          now: now);
      final data = {
        'width': frame.width,
        'height': frame.height,
        'bytes': bytes,
        'rotation': rotation,
        'bgra': Platform.isIOS,
        'rowStride': frame.planes.first.bytesPerRow
      };
      if (step == AutoFaceStep.waiting && before != step) await _clearFrames();
      if (step == AutoFaceStep.reference && before == AutoFaceStep.waiting)
        _neutral = await _save(data, 'reference');
      if (step == AutoFaceStep.action && before == AutoFaceStep.reference)
        _action = await _save(data, 'blink');
      if (!mounted) {
        await _clearFrames();
        return;
      }
      setState(() => _message = !centered
          ? 'Keep one face centered in good light'
          : step == AutoFaceStep.waiting
              ? 'Hold still for a moment'
              : step == AutoFaceStep.reference
                  ? 'Blink naturally — no buttons needed'
                  : 'Blink captured · open your eyes');
      if (step == AutoFaceStep.complete &&
          _neutral != null &&
          _action != null) {
        _finishing = true;
        _timeout?.cancel();
        await _camera?.stopImageStream();
        if (!mounted) {
          await _clearFrames();
          return;
        }
        _delivered = true;
        Navigator.pop(context, LiveFaceCapture(_neutral!, _action));
      }
    } catch (_) {
      if (mounted)
        setState(() => _error =
            'Live camera analysis could not continue. Go back and retry.');
    } finally {
      _processing = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if ((state == AppLifecycleState.inactive ||
            state == AppLifecycleState.paused) &&
        _camera?.value.isInitialized == true) {
      _timeout?.cancel();
      _camera?.dispose();
      _camera = null;
      if (mounted)
        setState(() =>
            _error = 'Camera interrupted. Go back and retry the live check.');
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timeout?.cancel();
    _camera?.dispose();
    // Do not close the native detector while a frame is still being processed.
    unawaited(_close());
    super.dispose();
  }

  Future<void> _close() async {
    while (_processing) {
      await Future<void>.delayed(const Duration(milliseconds: 20));
    }
    try {
      await _detector.close();
    } catch (_) {/* Camera cancellation must remain safe. */}
    if (!_delivered) await _clearFrames();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Quick live verification')),
      body: SafeArea(
          child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(children: [
                Text(_error ?? _message,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 16),
                Expanded(
                    child: Center(
                        child: _camera?.value.isInitialized == true
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(24),
                                child: AspectRatio(
                                    aspectRatio: 1 / _camera!.value.aspectRatio,
                                    child: CameraPreview(_camera!)))
                            : const CircularProgressIndicator())),
                const SizedBox(height: 16),
                const Text(
                    'Your face is checked automatically. Attendance is submitted only after server verification.',
                    textAlign: TextAlign.center),
                if (_error != null)
                  TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Back to attendance')),
              ]))));
}
