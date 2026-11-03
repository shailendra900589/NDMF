package com.nirmaldhara.microfinance

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.*
import android.os.*
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** On-duty GPS + upload pipeline; survives screen lock via foreground service + worker thread. */
class DutyLocationService : Service(), LocationListener {
    companion object {
        @Volatile var running = false

        private const val GPS_INTERVAL_MS = 3000L
        private const val GPS_MIN_DISTANCE_M = 0f
        /** Accept fixes up to 3 minutes old when the OS delivers them late (Doze / screen off). */
        private const val MAX_FIX_AGE_MS = 180_000L

        fun startIfStored(context: Context) {
            val prefs = context.getSharedPreferences("duty_location", MODE_PRIVATE)
            if (!prefs.getBoolean("active", false)) return
            if (prefs.getString("token", "").orEmpty().isBlank()) return
            val duty = Intent(context, DutyLocationService::class.java)
            try {
                if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(duty)
                else context.startService(duty)
                DutyLocationWatchdog.schedule(context)
            } catch (_: Exception) { /* OEM may block background start; Flutter retry on open. */ }
        }
    }

    private val worker = Executors.newSingleThreadScheduledExecutor()
    private val gpsCallbackExecutor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private lateinit var locations: LocationManager
    private val prefs by lazy { getSharedPreferences("duty_location", MODE_PRIVATE) }
    private var wake: PowerManager.WakeLock? = null
    private var registered = false
    private var issue = "Waiting for a fresh GPS fix"
    @Volatile private var lastNetworkIssue = ""
    private var locationThread: HandlerThread? = null
    private var locationHandler: Handler? = null

    private val providerChange = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            subscribe()
            worker.execute { heartbeat(); upload() }
        }
    }

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_SCREEN_OFF, Intent.ACTION_USER_PRESENT -> {
                    renewWakeLock()
                    subscribe()
                    worker.execute {
                        maybeSeedFromLastKnown()
                        heartbeat()
                        upload()
                    }
                }
            }
        }
    }

    override fun onBind(intent: Intent?) = null

    private fun iso(time: Long) =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
            .format(Date(time))

    private fun precisePermission() =
        checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun enabled() = try {
        locations.isProviderEnabled(LocationManager.GPS_PROVIDER)
    } catch (_: Exception) {
        false
    }

    override fun onCreate() {
        super.onCreate()
        locations = getSystemService(LOCATION_SERVICE) as LocationManager
        locationThread = HandlerThread("DutyGPS").also { it.start() }
        locationHandler = Handler(locationThread!!.looper)

        val notifications = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            notifications.createNotificationChannel(
                NotificationChannel(
                    "duty_native",
                    "On-duty location sharing",
                    NotificationManager.IMPORTANCE_LOW,
                ),
            )
        }
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "duty_native")
        else Notification.Builder(this)
        val notification = builder
            .setContentTitle("MyStaff Smart · On duty")
            .setContentText("GPS route recording continues with screen off until checkout.")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setContentIntent(open)
            .build()
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(2841, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            } else {
                startForeground(2841, notification)
            }
        } catch (_: Exception) {
            running = false
            stopSelf()
            return
        }
        running = true
        DutyLocationWatchdog.schedule(this)
        renewWakeLock()

        val providerFilter = IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION)
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(providerChange, providerFilter, RECEIVER_NOT_EXPORTED)
            registerReceiver(
                screenReceiver,
                IntentFilter().apply {
                    addAction(Intent.ACTION_SCREEN_OFF)
                    addAction(Intent.ACTION_USER_PRESENT)
                },
                RECEIVER_NOT_EXPORTED,
            )
        } else {
            registerReceiver(providerChange, providerFilter)
            registerReceiver(
                screenReceiver,
                IntentFilter().apply {
                    addAction(Intent.ACTION_SCREEN_OFF)
                    addAction(Intent.ACTION_USER_PRESENT)
                },
            )
        }
        registered = true

        worker.scheduleWithFixedDelay({
            try {
                if (!prefs.getBoolean("active", false)) return@scheduleWithFixedDelay
                renewWakeLock()
                maybeSeedFromLastKnown()
                heartbeat()
                upload()
            } catch (_: Exception) { /* retry next cycle */ }
        }, 1, 6, TimeUnit.SECONDS)
    }

    private fun renewWakeLock() {
        val power = getSystemService(POWER_SERVICE) as PowerManager
        if (wake == null) {
            wake = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MyStaffSmart:DutyGPS").apply {
                setReferenceCounted(false)
            }
        }
        if (wake?.isHeld != true) wake?.acquire(15 * 60 * 1000L)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!running) return START_NOT_STICKY
        val token = intent?.getStringExtra("token")
        if (token != null) {
            val owner = intent.getStringExtra("owner").orEmpty()
            val edit = prefs.edit()
            if (prefs.getString("owner", "") != owner) edit.remove("queue")
            edit.putString("owner", owner)
                .putString("token", token)
                .putString("baseUrl", intent.getStringExtra("baseUrl"))
                .putString("version", intent.getStringExtra("version"))
                .putBoolean("active", true)
                .commit()
        }
        if (!prefs.getBoolean("active", false)) {
            stopSelf()
            return START_NOT_STICKY
        }
        subscribe()
        DutyLocationWatchdog.schedule(this)
        return START_STICKY
    }

    @Suppress("MissingPermission")
    @androidx.annotation.RequiresApi(Build.VERSION_CODES.S)
    private fun subscribeHighAccuracyApi31() {
        val request = android.location.LocationRequest.Builder(GPS_INTERVAL_MS)
            .setQuality(android.location.LocationRequest.QUALITY_HIGH_ACCURACY)
            .setMinUpdateIntervalMillis(2000L)
            .setMinUpdateDistanceMeters(GPS_MIN_DISTANCE_M)
            .build()
        locations.requestLocationUpdates(
            LocationManager.GPS_PROVIDER,
            request,
            gpsCallbackExecutor,
            this,
        )
    }

    @Suppress("MissingPermission")
    private fun subscribe() {
        try {
            locations.removeUpdates(this)
            if (!precisePermission()) {
                issue = "Precise location permission missing"
                return
            }
            val looper = locationHandler?.looper ?: Looper.getMainLooper()
            if (
                locations.allProviders.contains(LocationManager.GPS_PROVIDER) &&
                locations.isProviderEnabled(LocationManager.GPS_PROVIDER)
            ) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    subscribeHighAccuracyApi31()
                } else {
                    @Suppress("DEPRECATION")
                    locations.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        GPS_INTERVAL_MS,
                        GPS_MIN_DISTANCE_M,
                        this,
                        looper,
                    )
                }
            }
            issue = if (enabled()) "Waiting for a fresh GPS fix" else "Device location is switched off"
        } catch (_: Exception) {
            issue = "Location permission or provider unavailable"
        }
    }

    private fun acceptLocation(location: Location): Boolean {
        if (location.provider != LocationManager.GPS_PROVIDER) return false
        if (location.isFromMockProvider) return false
        if (!location.hasAccuracy()) return false
        val fixAge = System.currentTimeMillis() - location.time
        if (fixAge < -5000 || fixAge > MAX_FIX_AGE_MS) return false
        return true
    }

    @Suppress("DEPRECATION")
    override fun onLocationChanged(location: Location) {
        if (!prefs.getBoolean("active", false)) return
        if (!acceptLocation(location)) return
        val point = JSONObject()
            .put("lat", location.latitude)
            .put("lng", location.longitude)
            .put("accuracy", location.accuracy.toDouble())
            .put("recordedAt", iso(location.time))
            .put("mocked", false)
        if (location.hasSpeed()) point.put("speed", location.speed.toDouble())
        if (location.hasBearing()) point.put("heading", location.bearing.toDouble())
        issue = if (location.accuracy <= 35) "GPS connected" else "Reduced GPS accuracy: ${location.accuracy.toInt()} m"
        worker.execute {
            try {
                enqueuePoint(point)
                heartbeat()
                upload()
            } catch (_: Exception) { }
        }
    }

    private fun enqueuePoint(point: JSONObject) {
        val queue = JSONArray(prefs.getString("queue", "[]"))
        val last = if (queue.length() > 0) queue.getJSONObject(queue.length() - 1).optString("recordedAt") else ""
        if (last != point.getString("recordedAt")) queue.put(point)
        val bounded = JSONArray()
        for (i in maxOf(0, queue.length() - 6000) until queue.length()) bounded.put(queue.get(i))
        prefs.edit().putString("queue", bounded.toString()).commit()
    }

    override fun onProviderEnabled(provider: String) {
        issue = "GPS enabled; waiting for fix"
    }

    override fun onProviderDisabled(provider: String) {
        issue = "GPS provider disabled"
    }

    @Deprecated("Legacy Android callback")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

    private fun post(path: String, body: JSONObject): JSONObject? {
        val base = prefs.getString("baseUrl", "").orEmpty().trimEnd('/')
        if (!base.startsWith("https://")) return null
        val connection = URL("$base$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.instanceFollowRedirects = false
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer ${prefs.getString("token", "")}")
            connection.setRequestProperty("Connection", "close")
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            if (code == 401) {
                prefs.edit().putBoolean("active", false).remove("token").commit()
                main.post { stopSelf() }
                return null
            }
            if (code !in 200..299) {
                lastNetworkIssue = "Server rejected $path (HTTP $code)"
                return null
            }
            lastNetworkIssue = ""
            return JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } catch (e: Exception) {
            lastNetworkIssue = "Server unavailable: ${e.javaClass.simpleName}"
            return null
        } finally {
            connection.disconnect()
        }
    }

    private fun airplaneOn(): Boolean = try {
        android.provider.Settings.Global.getInt(
            contentResolver,
            android.provider.Settings.Global.AIRPLANE_MODE_ON,
            0,
        ) == 1
    } catch (_: Exception) {
        false
    }

    private fun networkAvailable(): Boolean = try {
        val cm = getSystemService(CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
    } catch (_: Exception) {
        true
    }

    @Suppress("MissingPermission")
    private fun maybeSeedFromLastKnown() {
        if (!prefs.getBoolean("active", false) || !precisePermission()) return
        val queue = try {
            JSONArray(prefs.getString("queue", "[]"))
        } catch (_: Exception) {
            return
        }
        val lastAt = if (queue.length() > 0) queue.getJSONObject(queue.length() - 1).optString("recordedAt") else ""
        val stale = lastAt.isBlank() || (System.currentTimeMillis() - Date.parse(lastAt)) > 45_000L
        if (!stale) return
        try {
            val last = locations.getLastKnownLocation(LocationManager.GPS_PROVIDER) ?: return
            if (!acceptLocation(last)) return
            onLocationChanged(last)
        } catch (_: Exception) { }
    }

    private fun heartbeat() {
        val battery = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val status = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val power = getSystemService(POWER_SERVICE) as PowerManager
        val airplane = airplaneOn()
        val online = networkAvailable()
        if (airplane) issue = "Airplane mode is on"
        else if (!enabled()) issue = "Device location is switched off"
        val payload = JSONObject()
            .put("locationEnabled", enabled())
            .put("permission", if (precisePermission()) "granted" else "denied")
            .put("backgroundAllowed", true)
            .put("trackingActive", running)
            .put("appVersion", prefs.getString("version", "unknown"))
            .put("issue", if (lastNetworkIssue.isNotBlank()) lastNetworkIssue else issue)
            .put("powerSaveMode", power.isPowerSaveMode)
            .put("batteryOptimizationExempt", power.isIgnoringBatteryOptimizations(packageName))
            .put("charging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL)
            .put("trackingEngine", "android_native")
            .put("airplaneMode", airplane)
            .put("networkAvailable", online)
        if (level >= 0 && scale > 0) payload.put("batteryPercent", (level * 100 / scale).coerceIn(0, 100))
        val response = post("/tracking/heartbeat", payload)
        if (response?.optJSONObject("data")?.optBoolean("onDuty", true) == false) {
            prefs.edit().putBoolean("active", false).commit()
            main.post { stopSelf() }
        }
    }

    private fun upload() {
        val queue = JSONArray(prefs.getString("queue", "[]"))
        if (queue.length() == 0) return
        val batch = JSONArray()
        for (i in 0 until minOf(500, queue.length())) batch.put(queue.get(i))
        val response = post("/tracking/route-points", JSONObject().put("routePoints", batch))
        if (response?.optBoolean("success") == true) {
            val remaining = JSONArray()
            for (i in batch.length() until queue.length()) remaining.put(queue.get(i))
            prefs.edit().putString("queue", remaining.toString()).commit()
        }
    }

    override fun onDestroy() {
        if (!prefs.getBoolean("active", false)) DutyLocationWatchdog.cancel(this)
        running = false
        try {
            locations.removeUpdates(this)
        } catch (_: Exception) { }
        if (registered) {
            try {
                unregisterReceiver(providerChange)
            } catch (_: Exception) { }
            try {
                unregisterReceiver(screenReceiver)
            } catch (_: Exception) { }
        }
        worker.shutdownNow()
        gpsCallbackExecutor.shutdownNow()
        locationThread?.quitSafely()
        locationThread = null
        locationHandler = null
        if (wake?.isHeld == true) wake?.release()
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (prefs.getBoolean("active", false)) {
            try {
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(Intent(this, DutyLocationService::class.java))
                else startService(Intent(this, DutyLocationService::class.java))
            } catch (_: Exception) { }
            DutyLocationWatchdog.schedule(this)
        }
        super.onTaskRemoved(rootIntent)
    }
}
