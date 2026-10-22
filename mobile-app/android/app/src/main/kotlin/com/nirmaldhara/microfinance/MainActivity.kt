package com.nirmaldhara.microfinance

import android.app.Activity
import android.app.ActivityManager
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.telecom.TelecomManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val securityChannel = "com.nirmaldhara.microfinance/security"
    private val telephonyChannel = "com.nirmaldhara.microfinance/telephony"
    private val recordingChannel = "com.nirmaldhara.microfinance/call_recording"

    @Volatile
    private var lastCallState: String = "idle"

    private var pendingCallResult: MethodChannel.Result? = null
    private var pendingNumber: String? = null

    @Suppress("DEPRECATION")
    private val phoneStateListener = object : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            lastCallState = mapCallState(state)
        }
    }

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
                            lastCallState = mapCallState(tm.callState)
                            result.success(lastCallState)
                        } catch (e: Exception) {
                            result.success(lastCallState)
                        }
                    }
                    "isDefaultDialer" -> result.success(isDefaultDialer())
                    "openAppSettings" -> result.success(openAppSettings())
                    "placeOutgoing" -> {
                        val number = call.argument<String>("number")?.filter { it.isDigit() }.orEmpty()
                        result.success(if (number.length < 10) false else placeOutgoingCall(number))
                    }
                    "placeInApp" -> {
                        val number = call.argument<String>("number")?.filter { it.isDigit() }.orEmpty()
                        if (number.length < 10) {
                            result.success("failed")
                        } else if (isDefaultDialer()) {
                            result.success(if (placeThroughTelecom(number)) "placed" else "failed")
                        } else {
                            pendingCallResult = result
                            pendingNumber = number
                            if (!requestDialerRole()) {
                                pendingCallResult = null
                                pendingNumber = null
                                result.success("denied")
                            }
                        }
                    }
                    "hangUp" -> {
                        NdfaInCallService.hangUp()
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, recordingChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "start" -> {
                        try {
                            val intent = Intent(this, CallRecordService::class.java)
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startForegroundService(intent)
                            } else {
                                startService(intent)
                            }
                            result.success(true)
                        } catch (e: Exception) {
                            result.success(false)
                        }
                    }
                    "stop" -> {
                        val path = CallRecordService.instance?.finish()
                        result.success(path)
                    }
                    "isRecording" -> result.success(CallRecordService.isActive())
                    else -> result.notImplemented()
                }
            }

        try {
            val tm = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            @Suppress("DEPRECATION")
            tm.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
            lastCallState = mapCallState(tm.callState)
        } catch (_: Exception) {
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyCallWindow(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyCallWindow(intent)
    }

    @Deprecated("Activity result is still required for the dialer-role prompt")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_DIALER_ROLE) return
        val pending = pendingCallResult
        val number = pendingNumber
        pendingCallResult = null
        pendingNumber = null
        if (pending == null) return
        val granted = resultCode == Activity.RESULT_OK || isDefaultDialer()
        if (!number.isNullOrBlank() && granted && placeThroughTelecom(number)) {
            pending.success("placed")
        } else if (granted) {
            pending.success("failed")
        } else {
            pending.success("denied")
        }
    }

    private fun openAppSettings(): Boolean {
        return try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
            }
            startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun applyCallWindow(intent: Intent?) {
        if (intent?.getBooleanExtra(EXTRA_CALL, false) != true) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        try {
            val am = getSystemService(ActivityManager::class.java)
            am.moveTaskToFront(taskId, 0)
        } catch (_: Exception) {
        }
    }

    private fun isDefaultDialer(): Boolean {
        val telecom = getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        if (telecom.defaultDialerPackage == packageName) return true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(RoleManager::class.java)
            return roleManager.isRoleHeld(RoleManager.ROLE_DIALER)
        }
        return false
    }

    private fun requestDialerRole(): Boolean {
        return try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = getSystemService(RoleManager::class.java)
                if (!roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) return false
                roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
            } else {
                Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).putExtra(
                    TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME,
                    packageName
                )
            }
            startActivityForResult(intent, REQ_DIALER_ROLE)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun placeOutgoingCall(number: String): Boolean {
        return try {
            startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:$number")))
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun placeThroughTelecom(number: String): Boolean {
        return try {
            val telecom = getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val extras = Bundle()
            extras.putBoolean(TelecomManager.EXTRA_START_CALL_WITH_SPEAKERPHONE, true)
            telecom.placeCall(Uri.fromParts("tel", number, null), extras)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun mapCallState(state: Int): String {
        return when (state) {
            TelephonyManager.CALL_STATE_RINGING -> "ringing"
            TelephonyManager.CALL_STATE_OFFHOOK -> "offhook"
            else -> "idle"
        }
    }

    companion object {
        private const val REQ_DIALER_ROLE = 4101
        const val EXTRA_CALL = "ndfa_call"
    }
}
