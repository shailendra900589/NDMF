package com.nirmaldhara.microfinance

import android.content.Context
import android.os.Bundle
import android.telephony.TelephonyManager
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val securityChannel = "com.nirmaldhara.microfinance/security"
    private val telephonyChannel = "com.nirmaldhara.microfinance/telephony"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, securityChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "enableScreenshotProtection" -> {
                        window.setFlags(
                            WindowManager.LayoutParams.FLAG_SECURE,
                            WindowManager.LayoutParams.FLAG_SECURE
                        )
                        result.success(true)
                    }
                    "disableScreenshotProtection" -> {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, telephonyChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "getCallState" -> {
                        try {
                            val tm = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
                            result.success(mapCallState(tm.callState))
                        } catch (e: Exception) {
                            result.success("idle")
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun mapCallState(state: Int): String {
        return when (state) {
            TelephonyManager.CALL_STATE_RINGING -> "ringing"
            TelephonyManager.CALL_STATE_OFFHOOK -> "offhook"
            else -> "idle"
        }
    }
}
