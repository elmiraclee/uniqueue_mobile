package com.uniqueue.widget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

/**
 * One-second active-ticket sync.
 *
 * Android does not allow a normal home-screen widget or suspended JS runtime
 * to execute every second. A user-visible foreground service is the supported
 * mechanism for this level of realtime work. It runs only while a ticket is
 * active and keeps a persistent "Live ticket active" notification visible.
 */
class UniqueueRealtimeService : Service() {
  companion object {
    private const val LIVE_CHANNEL = "live_ticket_service_v1"
    private const val ALARM_CHANNEL = "proceed_alert_v5"
    private const val LIVE_NOTIFICATION_ID = 5201
    private const val ALARM_NOTIFICATION_ID = 5202
    private const val POLL_MS = 1_000L

    fun start(context: Context) {
      val prefs = context.getSharedPreferences(UniqueueWidgetProvider.PREFS, 0)
      val ticketId = prefs.getLong("ticketId", 0L)
      val status = prefs.getString("status", "").orEmpty().lowercase(Locale.ROOT)
      if (ticketId <= 0L || status in setOf("completed", "cancelled", "done")) return
      val intent = Intent(context, UniqueueRealtimeService::class.java)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (_: Throwable) {
        // Server push + periodic widget refresh remain as fallbacks when an
        // OEM blocks background foreground-service starts.
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, UniqueueRealtimeService::class.java))
    }
  }

  private val running = AtomicBoolean(false)
  private var worker: Thread? = null
  private var wakeLock: PowerManager.WakeLock? = null

  private var isForeground = false

  override fun onCreate() {
    super.onCreate()
    createChannels()
    // startForeground() throws on Android 12+ when the OS refuses a
    // background foreground-service start (widget update, boot, OEM limits;
    // Android 15 also blocks dataSync from BOOT_COMPLETED). Without this
    // guard the whole app process crashed in the background.
    isForeground = try {
      val notification = buildLiveNotification("Connecting to live queue…")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          LIVE_NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        )
      } else {
        startForeground(LIVE_NOTIFICATION_ID, notification)
      }
      true
    } catch (_: Throwable) {
      false
    }
    if (!isForeground) {
      // Push + periodic widget refresh remain as fallbacks.
      UniqueueWidgetProvider.scheduleNextRefresh(this)
      stopSelf()
      return
    }
    try {
      val power = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = power.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK,
        "Uniqueue:LiveTicketSync"
      ).apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (_: Throwable) {
      wakeLock = null
    }
  }

  // Android 15+: dataSync foreground services have a daily time limit.
  // The service must stop itself here or the OS crashes the app.
  override fun onTimeout(startId: Int, fgsType: Int) {
    running.set(false)
    UniqueueWidgetProvider.scheduleNextRefresh(this)
    stopSelf()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!isForeground) {
      stopSelf()
      return START_NOT_STICKY
    }
    if (running.compareAndSet(false, true)) {
      worker = Thread({ runLoop() }, "uniqueue-live-ticket").apply { start() }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    running.set(false)
    worker?.interrupt()
    worker = null
    try {
      if (wakeLock?.isHeld == true) wakeLock?.release()
    } catch (_: Throwable) {
      // already released
    }
    wakeLock = null
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun runLoop() {
    while (running.get()) {
      val started = System.currentTimeMillis()
      try {
        if (!pollOnce()) break
      } catch (_: Throwable) {
        // Keep the last widget value and retry on the next second.
      }
      val remaining = POLL_MS - (System.currentTimeMillis() - started)
      if (remaining > 0) {
        try {
          Thread.sleep(remaining)
        } catch (_: InterruptedException) {
          break
        }
      }
    }
    stopSelf()
  }

  /** Returns false when there is no longer an active ticket. */
  private fun pollOnce(): Boolean {
    val prefs = getSharedPreferences(UniqueueWidgetProvider.PREFS, 0)
    val ticketId = prefs.getLong("ticketId", 0L)
    val endpoint = prefs.getString("endpoint", "").orEmpty()
    if (ticketId <= 0L || endpoint.isBlank()) return false

    val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 4_000
      readTimeout = 4_000
      doOutput = true
      useCaches = false
      setRequestProperty("Content-Type", "application/json")
      setRequestProperty("Cache-Control", "no-cache")
    }
    connection.outputStream.use {
      it.write("{\"ticket_id\":$ticketId,\"queue_id\":$ticketId}".toByteArray())
    }
    val code = connection.responseCode
    val raw = (if (code in 200..299) connection.inputStream else connection.errorStream)
      ?.bufferedReader()?.use { it.readText() }.orEmpty()
    connection.disconnect()
    if (code !in 200..299 || raw.isBlank()) return true

    val json = JSONObject(raw)
    if (!json.optBoolean("success")) return true
    val queue = json.optJSONObject("queue") ?: return true
    fun text(source: JSONObject, key: String) =
      if (source.isNull(key)) "" else source.optString(key, "")

    val status = text(queue, "status").lowercase(Locale.ROOT)
    val queueNumber = text(queue, "queue_number")
    val window = text(queue, "window")
    val alarmKey = "$ticketId:$status"
    val previousAlarmKey = prefs.getString("lastRealtimeAlarmKey", "").orEmpty()
    val alarmStatus = status in setOf("next", "next_in_line", "called", "in_progress")

    prefs.edit()
      .putString("ticket", queueNumber)
      .putString("office", text(queue, "office"))
      .putString("window", window)
      .putString("status", status)
      .putString("nowServing", text(json, "now_serving"))
      .putInt("peopleAhead", json.optInt("people_ahead", -1))
      .putInt("estimatedWait", json.optInt("estimated_wait", -1))
      .putLong("updatedAt", System.currentTimeMillis())
      .apply()

    UniqueueWidgetProvider().renderCached(this)
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(
      LIVE_NOTIFICATION_ID,
      buildLiveNotification("Ticket $queueNumber · ${status.ifBlank { "active" }}")
    )

    if (alarmStatus && alarmKey != previousAlarmKey) {
      prefs.edit().putString("lastRealtimeAlarmKey", alarmKey).apply()
      vibrateTurnAlarm()
      manager.notify(
        ALARM_NOTIFICATION_ID,
        buildTurnNotification(queueNumber, window, status)
      )
    }

    val finished = status in setOf("completed", "cancelled", "done")
    return !finished
  }

  private fun createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(
        LIVE_CHANNEL,
        "Live Ticket Sync",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Keeps your active ticket and home-screen widget live"
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      }
    )

    val soundId = resources.getIdentifier("alarm", "raw", packageName)
    val soundUri = if (soundId != 0) {
      Uri.parse("android.resource://$packageName/$soundId")
    } else null
    val audio = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    manager.createNotificationChannel(
      NotificationChannel(
        ALARM_CHANNEL,
        "Your Turn — Proceed Now",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Urgent turn and proceed alerts"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 800, 300, 800, 300, 1200)
        if (soundUri != null) setSound(soundUri, audio)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
    )
  }

  private fun buildLiveNotification(text: String): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, LIVE_CHANNEL)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_LOW)
    }
    return builder
      .setSmallIcon(notificationIcon())
      .setContentTitle("Uniqueue live ticket active")
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(openAppIntent(5301))
      .build()
  }

  private fun buildTurnNotification(ticket: String, window: String, status: String): Notification {
    val title = if (status == "next" || status == "next_in_line") {
      "You're next in line"
    } else {
      "It's your turn — proceed now"
    }
    val body = listOf("Ticket $ticket", window).filter { it.isNotBlank() }.joinToString(" · ")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, ALARM_CHANNEL)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_MAX)
    }
    return builder
      .setSmallIcon(notificationIcon())
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(Notification.CATEGORY_ALARM)
      .setAutoCancel(true)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(openAppIntent(5302))
      .build()
  }

  private fun openAppIntent(requestCode: Int): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    } ?: return null
    return PendingIntent.getActivity(
      this,
      requestCode,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun notificationIcon(): Int {
    val generated = resources.getIdentifier("notification_icon", "drawable", packageName)
    return if (generated != 0) generated else android.R.drawable.ic_popup_sync
  }

  private fun vibrateTurnAlarm() {
    val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      getSystemService(VibratorManager::class.java).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    if (!vibrator.hasVibrator()) return
    val pattern = longArrayOf(
      0, 700, 250, 700, 250, 1000, 350,
      700, 250, 700, 250, 1000, 350,
      700, 250, 700, 250, 1000
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
    } else {
      @Suppress("DEPRECATION")
      vibrator.vibrate(pattern, -1)
    }
  }
}
