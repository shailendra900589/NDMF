package com.nirmaldhara.microfinance

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Person
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.VideoProfile

/**
 * Owns the live carrier call after MyStaff Smart is the Phone app.
 * The stock Phone app is not started.
 */
class NdfaInCallService : InCallService() {
    private val handler = Handler(Looper.getMainLooper())
    private val bringBack = Runnable { bringAppForward() }

    private val callback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            if (state == Call.STATE_ACTIVE || state == Call.STATE_DIALING || state == Call.STATE_CONNECTING) {
                forceSpeaker()
                scheduleBringForward()
            }
        }
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        activeCalls.add(call)
        try {
            call.registerCallback(callback)
        } catch (_: Exception) {
        }
        forceSpeaker()
        startRecording()
        showCallNotification(call)
        scheduleBringForward()
    }

    override fun onCallRemoved(call: Call) {
        try {
            call.unregisterCallback(callback)
        } catch (_: Exception) {
        }
        activeCalls.remove(call)
        if (activeCalls.isEmpty()) {
            handler.removeCallbacksAndMessages(null)
            try {
                getSystemService(NotificationManager::class.java).cancel(CALL_NOTE_ID)
            } catch (_: Exception) {
            }
        }
        super.onCallRemoved(call)
    }

    private fun showCallNotification(call: Call) {
        try {
            val channelId = "ndfa_in_call"
            val manager = getSystemService(NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                manager.createNotificationChannel(
                    NotificationChannel(channelId, "MyStaff Smart call", NotificationManager.IMPORTANCE_HIGH)
                )
            }
            val open = PendingIntent.getActivity(
                this,
                0,
                Intent(this, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                    .putExtra(MainActivity.EXTRA_CALL, true),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val end = actionIntent("END", 2)
            val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(this, channelId)
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(this)
            }
            val ringing = call.state == Call.STATE_RINGING
            builder
                .setSmallIcon(android.R.drawable.sym_call_outgoing)
                .setContentTitle("MyStaff Smart")
                .setContentText(if (ringing) "Incoming call" else "Call in MyStaff Smart")
                .setContentIntent(open)
                .setFullScreenIntent(open, true)
                .setCategory(Notification.CATEGORY_CALL)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
            val endIcon = Icon.createWithResource(this, android.R.drawable.ic_menu_close_clear_cancel)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !ringing) {
                val person = Person.Builder().setName("Customer").setImportant(true).build()
                builder.setStyle(Notification.CallStyle.forOngoingCall(person, end))
            } else {
                builder.addAction(Notification.Action.Builder(endIcon, "End", end).build())
                if (ringing) {
                    val answerIcon = Icon.createWithResource(this, android.R.drawable.ic_menu_call)
                    builder.addAction(
                        Notification.Action.Builder(answerIcon, "Answer", actionIntent("ANSWER", 1)).build()
                    )
                }
            }
            manager.notify(CALL_NOTE_ID, builder.build())
        } catch (_: Exception) {
        }
    }

    private fun actionIntent(action: String, request: Int): PendingIntent {
        val intent = Intent(this, CallActionReceiver::class.java).setAction(action)
        return PendingIntent.getBroadcast(
            this,
            request,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun forceSpeaker() {
        try {
            @Suppress("DEPRECATION")
            setAudioRoute(CallAudioState.ROUTE_SPEAKER)
        } catch (_: Exception) {
        }
    }

    private fun startRecording() {
        try {
            val intent = Intent(this, CallRecordService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        } catch (_: Exception) {
        }
    }

    private fun scheduleBringForward() {
        bringAppForward()
        handler.removeCallbacks(bringBack)
        handler.postDelayed(bringBack, 400)
        handler.postDelayed(bringBack, 1200)
    }

    private fun bringAppForward() {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                )
                putExtra(MainActivity.EXTRA_CALL, true)
            }
            startActivity(intent)
        } catch (_: Exception) {
        }
    }

    companion object {
        private val activeCalls = mutableListOf<Call>()

        private const val CALL_NOTE_ID = 7102

        fun hangUp() {
            val snapshot = activeCalls.toList()
            for (call in snapshot) {
                try {
                    call.disconnect()
                } catch (_: Exception) {
                }
            }
        }

        fun answer() {
            for (call in activeCalls.toList()) {
                try {
                    if (call.state == Call.STATE_RINGING) {
                        call.answer(VideoProfile.STATE_AUDIO_ONLY)
                    }
                } catch (_: Exception) {
                }
            }
        }
    }
}

class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "ANSWER") NdfaInCallService.answer() else NdfaInCallService.hangUp()
    }
}
