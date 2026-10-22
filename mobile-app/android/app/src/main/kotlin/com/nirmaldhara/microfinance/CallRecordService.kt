package com.nirmaldhara.microfinance

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.telephony.TelephonyManager
import java.io.File
import java.io.RandomAccessFile

/**
 * Records the handset microphone for the whole customer call (up to 60 min).
 *
 * Cellular call audio is not available to normal apps. Speaker stays on and
 * echo-cancellation stays off so both the officer and the customer (from the
 * speaker) are written into the file. Voice-communication mode is avoided
 * because it cancels that speaker audio and leaves a silent file.
 */
class CallRecordService : Service() {
    private var audioRecord: AudioRecord? = null
    private var writer: Thread? = null
    private var wavFile: RandomAccessFile? = null
    private var outputPath: String? = null
    private var sampleRate: Int = 44100
    private var dataBytes: Int = 0

    @Volatile
    private var running: Boolean = false

    private var wakeLock: PowerManager.WakeLock? = null
    private var previousAudioMode: Int = AudioManager.MODE_NORMAL
    private var previousSpeaker: Boolean = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        instance = this
        promoteForeground()
        acquireWakeLock()
        if (!running) {
            startCapture()
        }
        if (!running) {
            releaseWakeLock()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stopCapture(keepFile = true)
        restoreAudioRoute()
        releaseWakeLock()
        if (instance === this) instance = null
        super.onDestroy()
    }

    fun finish(): String? {
        val path = stopCapture(keepFile = true)
        restoreAudioRoute()
        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        if (instance === this) instance = null
        return path
    }

    private fun promoteForeground() {
        val channelId = "ndfa_call_recording"
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Call recording",
                NotificationManager.IMPORTANCE_LOW
            )
            manager.createNotificationChannel(channel)
        }
        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
                .setContentTitle("Nirmaldhara")
                .setContentText("Recording customer call")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("Nirmaldhara")
                .setContentText("Recording customer call")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setOngoing(true)
                .build()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(7101, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(7101, notification)
        }
    }

    private fun startCapture() {
        val dir = getExternalFilesDir(null) ?: filesDir
        val file = File(dir, "call_${System.currentTimeMillis()}.wav")
        outputPath = file.absolutePath
        routeMicForCall()

        val opened = openRecorder()
        if (opened == null) {
            outputPath = null
            return
        }
        audioRecord = opened.first
        sampleRate = opened.second
        disableVoiceProcessing(opened.first.audioSessionId)

        val raf = RandomAccessFile(file, "rw")
        wavFile = raf
        dataBytes = 0
        writeWavHeader(raf, sampleRate, 0)
        running = true

        val thread = Thread {
            val buffer = ByteArray(opened.first.bufferSizeInFrames.coerceAtLeast(2048) * 2)
            var lastHeader = System.currentTimeMillis()
            var lastRoute = lastHeader
            val startedAt = lastHeader
            while (running) {
                if (System.currentTimeMillis() - startedAt > MAX_MS) break
                val rec = audioRecord
                if (rec == null || rec.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
                    restartRecorder()
                    continue
                }
                val read = try {
                    rec.read(buffer, 0, buffer.size)
                } catch (_: Exception) {
                    -1
                }
                if (read > 0) {
                    try {
                        raf.write(buffer, 0, read)
                        dataBytes += read
                    } catch (_: Exception) {
                        break
                    }
                } else {
                    try {
                        Thread.sleep(200)
                    } catch (_: Exception) {
                    }
                    restartRecorder()
                }
                val now = System.currentTimeMillis()
                if (now - lastHeader >= 1000) {
                    patchHeader(raf, sampleRate, dataBytes)
                    lastHeader = now
                }
                if (now - lastRoute >= 15000) {
                    routeMicForCall()
                    lastRoute = now
                }
            }
            running = false
            patchHeader(raf, sampleRate, dataBytes)
        }
        thread.name = "ndfa-call-rec"
        writer = thread
        thread.start()
    }

    private fun openRecorder(): Pair<AudioRecord, Int>? {
        val sources = intArrayOf(
            MediaRecorder.AudioSource.CAMCORDER,
            MediaRecorder.AudioSource.MIC,
            MediaRecorder.AudioSource.UNPROCESSED,
            MediaRecorder.AudioSource.VOICE_RECOGNITION
        )
        // 16 kHz mono stays under the upload limit for a full 60 minute call.
        val rates = intArrayOf(16000, 8000)
        for (source in sources) {
            for (rate in rates) {
                val min = AudioRecord.getMinBufferSize(
                    rate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )
                if (min <= 0) continue
                val rec = try {
                    AudioRecord(
                        source,
                        rate,
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        min * 2
                    )
                } catch (_: Exception) {
                    continue
                }
                if (rec.state != AudioRecord.STATE_INITIALIZED) {
                    rec.release()
                    continue
                }
                try {
                    rec.startRecording()
                } catch (_: Exception) {
                    rec.release()
                    continue
                }
                if (rec.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    return rec to rate
                }
                rec.release()
            }
        }
        return null
    }

    private fun restartRecorder() {
        try {
            audioRecord?.stop()
        } catch (_: Exception) {
        }
        try {
            audioRecord?.release()
        } catch (_: Exception) {
        }
        audioRecord = null
        val opened = openRecorder() ?: return
        audioRecord = opened.first
        if (opened.second != sampleRate) {
            // Keep the file's original rate; a mismatched restart is dropped.
            try {
                opened.first.stop()
            } catch (_: Exception) {
            }
            opened.first.release()
            audioRecord = null
            return
        }
        disableVoiceProcessing(opened.first.audioSessionId)
    }

    private fun disableVoiceProcessing(sessionId: Int) {
        try {
            if (AcousticEchoCanceler.isAvailable()) {
                AcousticEchoCanceler.create(sessionId)?.enabled = false
            }
        } catch (_: Exception) {
        }
        try {
            if (NoiseSuppressor.isAvailable()) {
                NoiseSuppressor.create(sessionId)?.enabled = false
            }
        } catch (_: Exception) {
        }
        try {
            if (AutomaticGainControl.isAvailable()) {
                AutomaticGainControl.create(sessionId)?.enabled = false
            }
        } catch (_: Exception) {
        }
    }

    @Suppress("DEPRECATION")
    private fun routeMicForCall() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            if (previousAudioMode == AudioManager.MODE_NORMAL && !previousSpeaker) {
                previousAudioMode = am.mode
                previousSpeaker = am.isSpeakerphoneOn
            }
            val telephony = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val inCall = telephony.callState == TelephonyManager.CALL_STATE_OFFHOOK ||
                telephony.callState == TelephonyManager.CALL_STATE_RINGING
            // Leave MODE_IN_CALL alone while the carrier call is up. Forcing
            // normal mode here drops speaker audio and the system phone UI
            // comes back on top.
            if (!inCall) {
                am.mode = AudioManager.MODE_NORMAL
            }
            am.isSpeakerphoneOn = true
        } catch (_: Exception) {
        }
    }

    private fun restoreAudioRoute() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            am.isSpeakerphoneOn = previousSpeaker
            am.mode = previousAudioMode
        } catch (_: Exception) {
        }
    }

    private fun stopCapture(keepFile: Boolean): String? {
        running = false
        try {
            writer?.join(2500)
        } catch (_: Exception) {
        }
        writer = null
        try {
            audioRecord?.stop()
        } catch (_: Exception) {
        }
        try {
            audioRecord?.release()
        } catch (_: Exception) {
        }
        audioRecord = null
        val path = outputPath
        try {
            wavFile?.let { patchHeader(it, sampleRate, dataBytes) }
            wavFile?.close()
        } catch (_: Exception) {
        }
        wavFile = null
        outputPath = null
        dataBytes = 0
        if (!keepFile || path == null) return null
        val file = File(path)
        return if (file.exists() && file.length() > 44) path else null
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ndfa:call-recording").apply {
            setReferenceCounted(false)
            acquire(MAX_MS)
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {
        }
        wakeLock = null
    }

    private fun patchHeader(raf: RandomAccessFile, rate: Int, pcmBytes: Int) {
        val pos = raf.filePointer
        writeWavHeader(raf, rate, pcmBytes)
        raf.seek(pos)
    }

    private fun writeWavHeader(raf: RandomAccessFile, rate: Int, pcmBytes: Int) {
        val channels = 1
        val bits = 16
        val byteRate = rate * channels * bits / 8
        val blockAlign = channels * bits / 8
        val chunkSize = 36 + pcmBytes
        raf.seek(0)
        raf.writeBytes("RIFF")
        raf.write(intLe(chunkSize))
        raf.writeBytes("WAVE")
        raf.writeBytes("fmt ")
        raf.write(intLe(16))
        raf.write(shortLe(1))
        raf.write(shortLe(channels))
        raf.write(intLe(rate))
        raf.write(intLe(byteRate))
        raf.write(shortLe(blockAlign))
        raf.write(shortLe(bits))
        raf.writeBytes("data")
        raf.write(intLe(pcmBytes))
    }

    private fun intLe(value: Int): ByteArray = byteArrayOf(
        (value and 0xff).toByte(),
        (value shr 8 and 0xff).toByte(),
        (value shr 16 and 0xff).toByte(),
        (value shr 24 and 0xff).toByte()
    )

    private fun shortLe(value: Int): ByteArray = byteArrayOf(
        (value and 0xff).toByte(),
        (value shr 8 and 0xff).toByte()
    )

    companion object {
        private const val MAX_MS = 60L * 60L * 1000L

        @Volatile
        var instance: CallRecordService? = null

        fun isActive(): Boolean = instance?.running == true
    }
}
