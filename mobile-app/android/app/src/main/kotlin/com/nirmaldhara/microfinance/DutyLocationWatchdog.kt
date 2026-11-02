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
    private const val INTERVAL_MS = 5 * 60 * 1000L

    fun schedule(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, DutyLocationWatchdogReceiver::class.java).setAction(ACTION)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pending = PendingIntent.getBroadcast(context, REQUEST, intent, flags)
        val trigger = SystemClock.elapsedRealtime() + 60_000L
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pending)
            } else {
                am.setInexactRepeating(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    trigger,
                    INTERVAL_MS,
                    pending
                )
            }
        } catch (_: Exception) {
            am.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                trigger,
                INTERVAL_MS,
                pending
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
