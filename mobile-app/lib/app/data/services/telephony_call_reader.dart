import 'dart:io';
import 'package:call_log/call_log.dart';
import 'package:permission_handler/permission_handler.dart';

/// Reads Android system call log to verify real conversation (duration, answered/missed).
class TelephonyCallMatch {
  final int durationSeconds;
  final String callStatus; // connected | missed | not_answered | unknown
  final bool verified;
  final DateTime? callTimestamp;

  const TelephonyCallMatch({
    required this.durationSeconds,
    required this.callStatus,
    required this.verified,
    this.callTimestamp,
  });

  static const empty = TelephonyCallMatch(
    durationSeconds: 0,
    callStatus: 'unknown',
    verified: false,
  );
}

class TelephonyCallReader {
  static String _digits(String n) {
    final d = n.replaceAll(RegExp(r'\D'), '');
    if (d.length <= 10) return d;
    return d.substring(d.length - 10);
  }

  static Future<bool> ensurePermission() async {
    if (!Platform.isAndroid) return false;
    final phone = await Permission.phone.request();
    // Some devices map call log under phone; request explicitly where supported.
    return phone.isGranted;
  }

  /// Polls call log briefly after user returns from dialer (log may lag).
  static Future<TelephonyCallMatch> matchRecentOutgoing({
    required String mobile,
    required DateTime placedAt,
    int maxAttempts = 4,
    Duration attemptDelay = const Duration(milliseconds: 700),
  }) async {
    if (!Platform.isAndroid) return TelephonyCallMatch.empty;
    if (!await ensurePermission()) return TelephonyCallMatch.empty;

    final target = _digits(mobile);
    if (target.length < 10) return TelephonyCallMatch.empty;

    final from = placedAt.subtract(const Duration(minutes: 2));
    final to = DateTime.now().add(const Duration(minutes: 20));

    for (var i = 0; i < maxAttempts; i++) {
      if (i > 0) await Future<void>.delayed(attemptDelay);
      try {
        final entries = await CallLog.query(
          dateFrom: from.millisecondsSinceEpoch,
          dateTo: to.millisecondsSinceEpoch,
        );
        CallLogEntry? best;
        for (final e in entries) {
          if (e.number == null) continue;
          if (_digits(e.number!) != target) continue;
          if (e.callType != CallType.outgoing && e.callType != CallType.missed) continue;
          if (best == null || (e.timestamp ?? 0) > (best.timestamp ?? 0)) {
            best = e;
          }
        }
        if (best != null) {
          final secs = best.duration ?? 0;
          final status = _mapStatus(best.callType, secs);
          return TelephonyCallMatch(
            durationSeconds: secs,
            callStatus: status,
            verified: true,
            callTimestamp: best.timestamp != null
                ? DateTime.fromMillisecondsSinceEpoch(best.timestamp!)
                : null,
          );
        }
      } catch (_) {}
    }
    return TelephonyCallMatch.empty;
  }

  static String _mapStatus(CallType? type, int durationSeconds) {
    if (type == CallType.missed) return 'missed';
    if (durationSeconds > 0) return 'connected';
    return 'not_answered';
  }
}
