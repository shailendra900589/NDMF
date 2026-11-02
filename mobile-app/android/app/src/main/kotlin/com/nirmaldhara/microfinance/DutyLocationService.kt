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

/** Visible on-duty collection and durable upload independent of Flutter timers. */
class DutyLocationService : Service(), LocationListener {
    companion object {
        @Volatile var running = false
        /** Foreground notification could not start; [running] stays false. */
        @Volatile var lastStartFailed = false

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
    private val main = Handler(Looper.getMainLooper())
    private lateinit var locations: LocationManager
    private val prefs by lazy { getSharedPreferences("duty_location", MODE_PRIVATE) }
    private var wake: PowerManager.WakeLock? = null
    private var registered = false
    private var issue = "Waiting for a fresh GPS fix"
    @Volatile private var lastNetworkIssue = ""
    private val providerChange = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            subscribe()
            worker.execute { heartbeat() }
        }
    }
    override fun onBind(intent: Intent?) = null
    private fun iso(time: Long) = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone=TimeZone.getTimeZone("UTC") }.format(Date(time))
    private fun precisePermission() = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
    // Network positioning may be available even after the user disables GPS.
    // Duty routes require the GPS provider, so report that specific state to
    // the administrator instead of falsely presenting network-only data as GPS.
    private fun enabled() = try { locations.isProviderEnabled(LocationManager.GPS_PROVIDER) } catch (_: Exception) { false }

    override fun onCreate() {
        super.onCreate()
        locations=getSystemService(LOCATION_SERVICE) as LocationManager
        val notifications=getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if(Build.VERSION.SDK_INT>=26) notifications.createNotificationChannel(NotificationChannel("duty_native","On-duty location sharing",NotificationManager.IMPORTANCE_LOW))
        val open=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val builder=if(Build.VERSION.SDK_INT>=26) Notification.Builder(this,"duty_native") else Notification.Builder(this)
        val notification=builder.setContentTitle("MyStaff Smart · On duty").setContentText("GPS and device status shared with your company until checkout. Tap to open.").setSmallIcon(android.R.drawable.ic_menu_mylocation).setOngoing(true).setContentIntent(open).build()
        lastStartFailed = false
        try {
            if(Build.VERSION.SDK_INT>=29)startForeground(2841,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION) else startForeground(2841,notification)
        } catch (_: Exception) {
            lastStartFailed = true
            running = false
            stopSelf()
            return
        }
        running = true
        DutyLocationWatchdog.schedule(this)
        wake=(getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"MyStaffSmart:DutyGPS").apply { setReferenceCounted(false); acquire(10*60*1000L) }
        if(Build.VERSION.SDK_INT>=33)registerReceiver(providerChange,IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION),Context.RECEIVER_NOT_EXPORTED)
        else registerReceiver(providerChange,IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION))
        registered=true
        worker.scheduleWithFixedDelay({
            try {
                if(!prefs.getBoolean("active",false))return@scheduleWithFixedDelay
                if(wake?.isHeld!=true)wake?.acquire(30*60*1000L)
                maybeSeedFromLastKnown()
                heartbeat()
                upload()
            }catch(_: Exception) { /* Keep durable fixes and retry next cycle. */ }
        },2,12,TimeUnit.SECONDS)
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if(!running)return START_NOT_STICKY
        val token=intent?.getStringExtra("token")
        if(token!=null){
            val owner=intent.getStringExtra("owner").orEmpty()
            val edit=prefs.edit()
            if(prefs.getString("owner","")!=owner)edit.remove("queue")
            edit.putString("owner",owner).putString("token",token).putString("baseUrl",intent.getStringExtra("baseUrl"))
                .putString("version",intent.getStringExtra("version")).putBoolean("active",true).commit()
        }
        if(!prefs.getBoolean("active",false)){stopSelf();return START_NOT_STICKY}
        subscribe()
        DutyLocationWatchdog.schedule(this)
        // Sticky restart when the OS reclaims the process during an open shift.
        return START_STICKY
    }
    @Suppress("MissingPermission")
    private fun subscribe(){
        try {
            locations.removeUpdates(this)
            if(!precisePermission()){issue="Precise location permission missing";return}
            // Attendance requires a real GPS route. Do not mix coarse
            // network-provider fixes into a route that is shown to admins.
            if(locations.allProviders.contains(LocationManager.GPS_PROVIDER)&&locations.isProviderEnabled(LocationManager.GPS_PROVIDER)){
                locations.requestLocationUpdates(LocationManager.GPS_PROVIDER,5000L,0f,this,Looper.getMainLooper())
            }
            issue=if(enabled())"Waiting for a fresh GPS fix" else "Device location is switched off"
        }catch(_: Exception){issue="Location permission or provider unavailable"}
    }
    @Suppress("DEPRECATION")
    override fun onLocationChanged(location: Location){
        if(!prefs.getBoolean("active",false))return
        if(location.provider != LocationManager.GPS_PROVIDER)return
        val age=SystemClock.elapsedRealtimeNanos()-location.elapsedRealtimeNanos
        if(age<0||age>60L*1000000000L||location.isFromMockProvider||!location.hasAccuracy())return
        val point=JSONObject().put("lat",location.latitude).put("lng",location.longitude).put("accuracy",location.accuracy.toDouble())
            .put("recordedAt",iso(location.time)).put("mocked",false)
        if(location.hasSpeed())point.put("speed",location.speed.toDouble())
        if(location.hasBearing())point.put("heading",location.bearing.toDouble())
        issue=if(location.accuracy<=35)"GPS connected" else "Reduced GPS accuracy: ${location.accuracy.toInt()} m"
        worker.execute {
            try {
                val queue=JSONArray(prefs.getString("queue","[]"))
                val last=if(queue.length()>0)queue.getJSONObject(queue.length()-1).optString("recordedAt") else ""
                if(last!=point.getString("recordedAt"))queue.put(point)
                val bounded=JSONArray();for(i in maxOf(0,queue.length()-6000) until queue.length())bounded.put(queue.get(i))
                prefs.edit().putString("queue",bounded.toString()).commit()
            }catch(_: Exception){}
        }
    }
    override fun onProviderEnabled(provider: String){ issue="GPS enabled; waiting for fix" }
    override fun onProviderDisabled(provider: String){ issue="GPS provider disabled" }
    @Deprecated("Legacy Android callback") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

    private fun post(path:String,body:JSONObject):JSONObject? {
        val base=prefs.getString("baseUrl","").orEmpty().trimEnd('/')
        if(!base.startsWith("https://"))return null
        val connection=URL("$base$path").openConnection() as HttpURLConnection
        try{
            connection.requestMethod="POST";connection.connectTimeout=10000;connection.readTimeout=10000
            connection.instanceFollowRedirects=false;connection.doOutput=true
            connection.setRequestProperty("Content-Type","application/json")
            connection.setRequestProperty("Authorization","Bearer ${prefs.getString("token","")}")
            connection.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}
            val code=connection.responseCode
            if(code==401){prefs.edit().putBoolean("active",false).remove("token").commit();main.post{stopSelf()};return null}
            if(code !in 200..299){lastNetworkIssue="Server rejected $path (HTTP $code)";return null}
            lastNetworkIssue=""
            return JSONObject(connection.inputStream.bufferedReader().use{it.readText()})
        }catch(e:Exception){lastNetworkIssue="Server unavailable: ${e.javaClass.simpleName}";return null
        }finally{connection.disconnect()}
    }
    private fun airplaneOn(): Boolean = try {
        android.provider.Settings.Global.getInt(contentResolver, android.provider.Settings.Global.AIRPLANE_MODE_ON, 0) == 1
    } catch (_: Exception) { false }

    private fun networkAvailable(): Boolean = try {
        val cm = getSystemService(CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
    } catch (_: Exception) { true }

    @Suppress("MissingPermission")
    private fun maybeSeedFromLastKnown() {
        if (!prefs.getBoolean("active", false) || !precisePermission()) return
        val queue = try { JSONArray(prefs.getString("queue", "[]")) } catch (_: Exception) { return }
        val lastAt = if (queue.length() > 0) queue.getJSONObject(queue.length() - 1).optString("recordedAt") else ""
        val stale = lastAt.isBlank() || (System.currentTimeMillis() - Date.parse(lastAt)) > 90_000L
        if (!stale) return
        try {
            val last = locations.getLastKnownLocation(LocationManager.GPS_PROVIDER) ?: return
            if (last.isFromMockProvider || !last.hasAccuracy() || last.accuracy > 35f) return
            val age = SystemClock.elapsedRealtimeNanos() - last.elapsedRealtimeNanos
            if (age < 0 || age > 120L * 1000000000L) return
            onLocationChanged(last)
        } catch (_: Exception) { }
    }

    private fun heartbeat(){
        val battery=registerReceiver(null,IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level=battery?.getIntExtra(BatteryManager.EXTRA_LEVEL,-1)?:-1
        val scale=battery?.getIntExtra(BatteryManager.EXTRA_SCALE,100)?:100
        val status=battery?.getIntExtra(BatteryManager.EXTRA_STATUS,-1)
        val power=getSystemService(POWER_SERVICE) as PowerManager
        val airplane=airplaneOn()
        val online=networkAvailable()
        if(airplane) issue="Airplane mode is on"
        else if(!enabled()) issue="Device location is switched off"
        val payload=JSONObject().put("locationEnabled",enabled()).put("permission",if(precisePermission())"granted" else "denied")
            .put("backgroundAllowed",true).put("trackingActive",running).put("appVersion",prefs.getString("version","unknown"))
            .put("issue",if(lastNetworkIssue.isNotBlank())lastNetworkIssue else issue).put("powerSaveMode",power.isPowerSaveMode).put("batteryOptimizationExempt",power.isIgnoringBatteryOptimizations(packageName))
            .put("charging",status==BatteryManager.BATTERY_STATUS_CHARGING||status==BatteryManager.BATTERY_STATUS_FULL).put("trackingEngine","android_native")
            .put("airplaneMode",airplane).put("networkAvailable",online)
        if(level>=0&&scale>0)payload.put("batteryPercent",(level*100/scale).coerceIn(0,100))
        val response=post("/tracking/heartbeat",payload)
        // Only stop after a confirmed check-out from the server — never while still on duty.
        if(response?.optJSONObject("data")?.optBoolean("onDuty",true)==false){prefs.edit().putBoolean("active",false).commit();main.post{stopSelf()}}
    }
    private fun upload(){
        val queue=JSONArray(prefs.getString("queue","[]"))
        if(queue.length()==0)return
        val batch=JSONArray();for(i in 0 until minOf(500,queue.length()))batch.put(queue.get(i))
        val response=post("/tracking/route-points",JSONObject().put("routePoints",batch))
        if(response?.optBoolean("success")==true){
            val remaining=JSONArray();for(i in batch.length() until queue.length())remaining.put(queue.get(i))
            prefs.edit().putString("queue",remaining.toString()).commit()
        }
    }
    override fun onDestroy(){
        if (!prefs.getBoolean("active", false)) DutyLocationWatchdog.cancel(this)
        running=false
        try{locations.removeUpdates(this)}catch(_: Exception){}
        if(registered)try{unregisterReceiver(providerChange)}catch(_: Exception){}
        worker.shutdownNow()
        if(wake?.isHeld==true)wake?.release()
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // `stopWithTask=false` keeps the foreground service when the employee
        // swipes the UI away. Asking the system to keep it sticky here closes
        // an OEM-specific task-removal gap without starting a hidden service.
        if(prefs.getBoolean("active",false)){
            try { startService(Intent(this,DutyLocationService::class.java)) } catch(_: Exception) {}
        }
        super.onTaskRemoved(rootIntent)
    }
}
