import 'dart:io';

import 'package:flutter/services.dart';

/// Android telephony call state (idle / ringing / offhook).
class TelephonyBridge {
  TelephonyBridge._();

  static const _channel = MethodChannel('com.nirmaldhara.microfinance/telephony');

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
