package com.nirmaldhara.microfinance

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock

object DutyLocationWatchdog {
    const val ACTION = "com.nirmaldhara.microfinance.DUTY_LOCATION_WATCHDOG"
    private const val REQUEST = 2910
    /** Re-arm while on duty so OEM battery tools cannot leave tracking stopped. */
    private const val INTERVAL_MS = 3 * 60 * 1000L

    fun schedule(context: Context) {
        val prefs = context.getSharedPreferences("duty_location", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("active", false)) {
            cancel(context)
            return
        }
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, DutyLocationWatchdogReceiver::class.java).setAction(ACTION)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pending = PendingIntent.getBroadcast(context, REQUEST, intent, flags)
        val trigger = SystemClock.elapsedRealtime() + INTERVAL_MS
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pending)
            } else {
                am.setInexactRepeating(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    trigger,
                    INTERVAL_MS,
                    pending,
                )
            }
        } catch (_: Exception) {
            am.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                trigger,
                INTERVAL_MS,
                pending,
            )
        }
    }

    fun cancel(context: Context) {
        val intent = Intent(context, DutyLocationWatchdogReceiver::class.java).setAction(ACTION)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pending = PendingIntent.getBroadcast(context, REQUEST, intent, flags)
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pending)
    }
}
