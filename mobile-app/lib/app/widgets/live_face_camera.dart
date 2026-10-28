import 'dart:async';
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import '../utils/api_errors.dart';

class LiveFaceCapture {
  const LiveFaceCapture(this.neutralPath, this.actionPath);
  final String neutralPath;
  final String? actionPath;
}

/// Camera preview stays inside the app. No intent, gallery or file picker.
class LiveFaceCamera extends StatefulWidget {
  const LiveFaceCamera({super.key, this.action, this.validateCapture});
  final String? action;
  final Future<Map<String, dynamic>> Function(String neutral, String? action)?
      validateCapture;
  @override
  State<LiveFaceCamera> createState() => _LiveFaceCameraState();
}

class _LiveFaceCameraState extends State<LiveFaceCamera>
    with WidgetsBindingObserver {
  CameraController? _camera;
  String? _neutral, _error;
  String? _feedback;
  bool _checking = false;
  bool _busy = false;
  bool _delivered = false;
  int _count = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _open();
  }

  Future<void> _open() async {
    try {
      final cameras = await availableCameras();
      final front = cameras
          .where((c) => c.lensDirection == CameraLensDirection.front)
          .firstOrNull;
      if (front == null)
        throw Exception('A front camera is required for live attendance.');
      final camera =
          CameraController(front, ResolutionPreset.medium, enableAudio: false);
      _camera = camera;
      await camera.initialize();
      if (mounted)
        setState(() {});
      else
        await camera.dispose();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if ((state == AppLifecycleState.inactive ||
            state == AppLifecycleState.paused) &&
        _camera?.value.isInitialized == true) {
      _camera?.dispose();
      _camera = null;
      if (mounted)
        setState(() => _error =
            'Camera session interrupted. Go back and start a new live check.');
    }
  }

  Future<void> _capture() async {
    if (_busy || _camera?.value.isInitialized != true) return;
    setState(() {
      _busy = true;
      _feedback = null;
    });
    String? temporaryShot;
    try {
      for (var n = 3; n > 0; n--) {
        if (!mounted) return;
        setState(() => _count = n);
        await Future<void>.delayed(const Duration(seconds: 1));
      }
      if (!mounted || _camera?.value.isInitialized != true) return;
      final shot = await _camera!.takePicture();
      temporaryShot = shot.path;
      if (!mounted) return;
      if (widget.action != null && widget.validateCapture != null) {
        setState(() {
          _checking = true;
          _count = 0;
        });
        final result = await widget.validateCapture!(
            _neutral ?? shot.path, _neutral == null ? null : shot.path);
        if (!mounted) return;
        if (result['ready'] != true) {
          if (result['restartReference'] == true && _neutral != null) {
            await _delete(_neutral!);
            _neutral = null;
          }
          setState(() => _feedback = result['message']?.toString() ??
              'Adjust your pose and try this capture again.');
          return;
        }
      }
      if (_neutral == null && widget.action != null) {
        temporaryShot = null;
        setState(() {
          _neutral = shot.path;
          _feedback = 'Reference accepted. Follow step 2 below.';
        });
      } else {
        _delivered = true;
        temporaryShot = null;
        Navigator.pop(
            context,
            LiveFaceCapture(
                _neutral ?? shot.path, _neutral == null ? null : shot.path));
      }
    } catch (e) {
      if (mounted)
        setState(() =>
            _feedback = 'Capture could not be checked. ${apiErrorMessage(e)}');
    } finally {
      if (temporaryShot != null) await _delete(temporaryShot);
      if (mounted)
        setState(() {
          _busy = false;
          _checking = false;
          _count = 0;
        });
    }
  }

  Future<void> _delete(String path) async {
    try {
      await File(path).delete();
    } catch (_) {}
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _camera?.dispose();
    if (!_delivered && _neutral != null) unawaited(_delete(_neutral!));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final instruction = _neutral == null
        ? 'Look straight at the camera. Keep eyes open and mouth relaxed.'
        : widget.action == 'close_eyes'
            ? 'Close BOTH eyes fully. Hold them closed through the countdown.\nदोनों आँखें बंद रखें, फोटो होने तक न खोलें।'
            : 'Open your mouth WIDE. Hold it open through the countdown.\nमुँह खोलकर रखें, फोटो होने तक बंद न करें।';
    return Scaffold(
        appBar: AppBar(
            title: Text(widget.action == null
                ? 'Register face'
                : 'Live face verification')),
        body: SafeArea(
            child: SingleChildScrollView(
                child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(children: [
                      Text(instruction,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 16),
                      SizedBox(
                          height: MediaQuery.sizeOf(context).height * 0.42,
                          child: Center(
                              child: _camera?.value.isInitialized == true
                                  ? ClipRRect(
                                      borderRadius: BorderRadius.circular(20),
                                      child: AspectRatio(
                                          aspectRatio:
                                              1 / _camera!.value.aspectRatio,
                                          child: CameraPreview(_camera!)))
                                  : _error != null
                                      ? Text(_error!,
                                          textAlign: TextAlign.center)
                                      : const CircularProgressIndicator())),
                      const SizedBox(height: 12),
                      if (_feedback != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(_feedback!,
                              textAlign: TextAlign.center,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      Text(
                          _checking
                              ? 'Checking capture…'
                              : _count > 0
                                  ? 'Capturing in $_count…'
                                  : _neutral == null
                                      ? 'Step 1 · Face reference'
                                      : 'Step 2 · Live action',
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 12),
                      FilledButton.icon(
                          onPressed: _busy ||
                                  _error != null ||
                                  _camera?.value.isInitialized != true
                              ? null
                              : _capture,
                          icon: const Icon(Icons.face),
                          label: Text(_busy
                              ? _checking
                                  ? 'Checking…'
                                  : 'Hold the pose…'
                              : _neutral == null
                                  ? 'Capture face'
                                  : 'Ready · capture live action')),
                      if (_neutral != null)
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () async {
                                  await _delete(_neutral!);
                                  if (mounted)
                                    setState(() {
                                      _neutral = null;
                                      _feedback = null;
                                    });
                                },
                          child: const Text('Retake reference photo'),
                        ),
                    ])))));
  }
}
