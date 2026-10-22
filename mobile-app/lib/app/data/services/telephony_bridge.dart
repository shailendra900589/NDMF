import 'dart:io';

import 'package:flutter/services.dart';

/// Android telephony call state (idle / ringing / offhook).
class TelephonyBridge {
  TelephonyBridge._();

  static const _channel = MethodChannel('com.nirmaldhara.microfinance/telephony');

  static Future<bool> isDefaultDialer() async {
    if (!Platform.isAndroid) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('isDefaultDialer');
      return ok == true;
    } catch (_) {
      return false;
    }
  }

  /// Standard cellular call. Uses the phone permission only — not the
  /// default-Phone-app role, which Android blocks for sideloaded apps.
  static Future<bool> placeOutgoing(String number) async {
    if (!Platform.isAndroid) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('placeOutgoing', {'number': number});
      return ok == true;
    } catch (_) {
      return false;
    }
  }

  /// `placed`, `denied` (Android blocked the Phone-app role), or `failed`.
  /// Never opens the stock dialer.
  static Future<String> placeInApp(String number) async {
    if (!Platform.isAndroid) return 'failed';
    try {
      final status = await _channel.invokeMethod<String>('placeInApp', {'number': number});
      if (status == 'placed' || status == 'denied') return status!;
      return 'failed';
    } catch (_) {
      return 'failed';
    }
  }

  static Future<void> openAppSettings() async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod<bool>('openAppSettings');
    } catch (_) {}
  }

  static Future<void> hangUp() async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod<bool>('hangUp');
    } catch (_) {}
  }

  static Future<String> getCallState() async {
    if (!Platform.isAndroid) return 'idle';
    try {
      final state = await _channel.invokeMethod<String>('getCallState');
      return state ?? 'idle';
    } catch (_) {
      return 'idle';
    }
  }
}
