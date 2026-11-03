package com.nirmaldhara.microfinance

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Periodic safety net when OEM battery tools stop the foreground service. */
class DutyLocationWatchdogReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != DutyLocationWatchdog.ACTION) return
        DutyLocationService.startIfStored(context)
        DutyLocationWatchdog.schedule(context)
    }
}
