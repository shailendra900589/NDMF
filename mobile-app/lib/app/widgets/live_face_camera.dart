import 'dart:async';
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

class LiveFaceCapture {
  const LiveFaceCapture(this.neutralPath, this.actionPath);
  final String neutralPath;
  final String? actionPath;
}

/// Enrollment camera only. Attendance uses QuickFaceCamera automatically.
class LiveFaceCamera extends StatefulWidget {
  const LiveFaceCamera({super.key});
  @override
  State<LiveFaceCamera> createState() => _LiveFaceCameraState();
}

class _LiveFaceCameraState extends State<LiveFaceCamera>
    with WidgetsBindingObserver {
  CameraController? _camera;
  String? _error, _shot;
  bool _busy = false, _delivered = false;
  int _count = 0;
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
      final camera =
          CameraController(front, ResolutionPreset.medium, enableAudio: false);
      _camera = camera;
      await camera.initialize();
      if (mounted) {
        setState(() {});
      } else {
        await camera.dispose();
      }
    } catch (_) {
      if (mounted)
        setState(() =>
            _error = 'Allow camera permission and retry face enrollment.');
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
        setState(
            () => _error = 'Camera interrupted. Go back and retry enrollment.');
    }
  }

  Future<void> _delete() async {
    if (_shot != null) {
      try {
        await File(_shot!).delete();
      } catch (_) {}
    }
  }

  Future<void> _capture() async {
    if (_busy || _camera?.value.isInitialized != true) return;
    setState(() => _busy = true);
    try {
      for (var n = 3; n > 0; n--) {
        if (!mounted) return;
        setState(() => _count = n);
        await Future<void>.delayed(const Duration(seconds: 1));
      }
      if (!mounted || _camera?.value.isInitialized != true) return;
      _shot = (await _camera!.takePicture()).path;
      if (!mounted) {
        await _delete();
        return;
      }
      _delivered = true;
      Navigator.pop(context, LiveFaceCapture(_shot!, null));
    } catch (_) {
      if (mounted)
        setState(() => _error =
            'Could not capture the reference photo. Go back and retry.');
    } finally {
      if (mounted)
        setState(() {
          _busy = false;
          _count = 0;
        });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _camera?.dispose();
    if (!_delivered) unawaited(_delete());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Register face')),
      body: SafeArea(
          child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(children: [
                const Text('Keep your whole face visible in good, even light.',
                    textAlign: TextAlign.center),
                const SizedBox(height: 16),
                Expanded(
                    child: Center(
                        child: _camera?.value.isInitialized == true
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(20),
                                child: AspectRatio(
                                    aspectRatio: 1 / _camera!.value.aspectRatio,
                                    child: CameraPreview(_camera!)))
                            : _error != null
                                ? Text(_error!, textAlign: TextAlign.center)
                                : const CircularProgressIndicator())),
                const SizedBox(height: 12),
                if (_count > 0) Text('Capturing in $_count…'),
                FilledButton.icon(
                    onPressed: _busy ||
                            _error != null ||
                            _camera?.value.isInitialized != true
                        ? null
                        : _capture,
                    icon: const Icon(Icons.face),
                    label: Text(
                        _busy ? 'Hold steady…' : 'Capture reference photo')),
              ]))));
}
