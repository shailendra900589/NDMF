import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:audioplayers/audioplayers.dart';
import '../data/utils/recording_source_util.dart';
import '../theme/app_colors.dart';

/// Streams call recording online from server or plays local file — no download needed.
class StreamingRecordingPlayer extends StatefulWidget {
  final String? recordingUrl;
  final String? localRecordingPath;
  final bool compact;

  const StreamingRecordingPlayer({
    super.key,
    this.recordingUrl,
    this.localRecordingPath,
    this.compact = false,
  });

  @override
  State<StreamingRecordingPlayer> createState() => _StreamingRecordingPlayerState();
}

class _StreamingRecordingPlayerState extends State<StreamingRecordingPlayer> {
  final AudioPlayer _player = AudioPlayer();
  StreamSubscription<Duration>? _posSub;
  StreamSubscription<Duration>? _durSub;
  StreamSubscription<PlayerState>? _stateSub;

  bool _playing = false;
  bool _loading = false;
  bool _error = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  bool get _canPlay => RecordingSourceUtil.canPlay(
        recordingUrl: widget.recordingUrl,
        localRecordingPath: widget.localRecordingPath,
      );

  @override
  void initState() {
    super.initState();
    _stateSub = _player.onPlayerStateChanged.listen((s) {
      if (!mounted) return;
      setState(() {
        _playing = s == PlayerState.playing;
        if (s == PlayerState.playing || s == PlayerState.paused) _loading = false;
      });
    });
    _posSub = _player.onPositionChanged.listen((p) {
      if (mounted) setState(() => _position = p);
    });
    _durSub = _player.onDurationChanged.listen((d) {
      if (mounted) setState(() => _duration = d);
    });
  }

  Future<void> _togglePlay() async {
    if (!_canPlay) return;

    if (_playing) {
      await _player.pause();
      return;
    }

    setState(() {
      _loading = true;
      _error = false;
    });

    try {
      final source = await RecordingSourceUtil.resolveSource(
        recordingUrl: widget.recordingUrl,
        localRecordingPath: widget.localRecordingPath,
      );
      if (source == null) throw Exception('No source');

      await _player.stop();
      await _player.play(source);
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = true;
          _loading = false;
        });
      }
    }
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  String get _statusLabel {
    if (_error) return 'Playback failed — check connection';
    if (RecordingSourceUtil.isServerRecording(widget.recordingUrl)) {
      return 'Streaming online • ${_fmt(_position)} / ${_duration > Duration.zero ? _fmt(_duration) : '--:--'}';
    }
    return 'Local recording • ${_fmt(_position)} / ${_duration > Duration.zero ? _fmt(_duration) : '--:--'}';
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _stateSub?.cancel();
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_canPlay) {
      return Text('No recording', style: TextStyle(fontSize: 11, color: Colors.grey.shade500));
    }

    if (widget.compact) {
      return IconButton(
        icon: _loading
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
            : Icon(_playing ? Icons.pause_circle : Icons.play_circle, color: AppColors.primary),
        onPressed: _error ? null : _togglePlay,
        tooltip: 'Listen online',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            IconButton(
              icon: _loading
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(_playing ? Icons.pause_circle_filled : Icons.play_circle_filled,
                      color: AppColors.primary, size: 36),
              onPressed: _error ? null : _togglePlay,
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_duration > Duration.zero)
                    Slider(
                      value: _position.inMilliseconds.clamp(0, _duration.inMilliseconds).toDouble(),
                      max: _duration.inMilliseconds.toDouble(),
                      onChanged: (v) => _player.seek(Duration(milliseconds: v.toInt())),
                    ),
                  Text(
                    _statusLabel,
                    style: TextStyle(fontSize: 11, color: _error ? AppColors.error : AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}
