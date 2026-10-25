package com.uniqueue.widget

import android.app.PendingIntent
import android.app.AlarmManager
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class UniqueueWidgetProvider : AppWidgetProvider() {
  companion object {
    const val PREFS = "uniqueue_live_ticket_widget"
    const val ACTION_REFRESH = "com.uniqueue.widget.REFRESH"
    const val ACTION_PERIODIC_REFRESH = "com.uniqueue.widget.PERIODIC_REFRESH"
    private const val REFRESH_REQUEST_CODE = 4102
    private const val REFRESH_INTERVAL_MS = 60_000L

    private fun pendingFlags() = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    private fun refreshPendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, UniqueueWidgetProvider::class.java).apply {
        action = ACTION_PERIODIC_REFRESH
      }
      return PendingIntent.getBroadcast(context, REFRESH_REQUEST_CODE, intent, pendingFlags())
    }

    fun scheduleNextRefresh(context: Context) {
      val p = context.getSharedPreferences(PREFS, 0)
      val status = p.getString("status", "").orEmpty().lowercase(Locale.ROOT)
      val isFinished = status in setOf("completed", "cancelled", "done")
      val widgetIds = AppWidgetManager.getInstance(context)
        .getAppWidgetIds(ComponentName(context, UniqueueWidgetProvider::class.java))
      if (p.getLong("ticketId", 0L) <= 0L || isFinished || widgetIds.isEmpty()) {
        cancelScheduledRefresh(context)
        return
      }
      val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val at = SystemClock.elapsedRealtime() + REFRESH_INTERVAL_MS
      val pending = refreshPendingIntent(context)
      try {
        alarm.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pending)
      } catch (_: SecurityException) {
        // Android 12+ may deny exact alarms. This fallback can be batched by
        // the OS, while server push still refreshes immediately.
        alarm.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pending)
      }
    }

    fun cancelScheduledRefresh(context: Context) {
      val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      alarm.cancel(refreshPendingIntent(context))
    }
  }

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    renderAll(context, manager, ids)
    refreshFromNetwork(context, manager, ids)
    UniqueueRealtimeService.start(context)
  }

  fun renderCached(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val ids = manager.getAppWidgetIds(ComponentName(context, UniqueueWidgetProvider::class.java))
    renderAll(context, manager, ids)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == ACTION_REFRESH || intent.action == ACTION_PERIODIC_REFRESH) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, UniqueueWidgetProvider::class.java))
      renderAll(context, manager, ids, "Refreshing…")
      refreshFromNetwork(context, manager, ids)
    }
  }

  private fun renderAll(
    context: Context,
    manager: AppWidgetManager,
    ids: IntArray,
    footerOverride: String? = null
  ) {
    ids.forEach { manager.updateAppWidget(it, buildViews(context, footerOverride)) }
  }

  private fun jsonText(json: JSONObject, key: String): String =
    if (json.isNull(key)) "" else json.optString(key, "")

  private fun buildViews(context: Context, footerOverride: String? = null): RemoteViews {
    val p = context.getSharedPreferences(PREFS, 0)
    val ticketId = p.getLong("ticketId", 0L)
    val ticket = p.getString("ticket", "").orEmpty()
    val office = p.getString("office", "").orEmpty()
    val window = p.getString("window", "").orEmpty()
    val status = p.getString("status", "").orEmpty()
    val serving = p.getString("nowServing", "").orEmpty()
    val ahead = p.getInt("peopleAhead", -1)
    val eta = p.getInt("estimatedWait", -1)
    val updatedAt = p.getLong("updatedAt", 0L)

    val views = RemoteViews(context.packageName, R.layout.uniqueue_widget)
    val hasTicket = ticketId > 0L || ticket.isNotBlank()
    views.setTextViewText(R.id.widget_office,
      if (office.isBlank()) "UNIQUEUE · LIVE TICKET" else listOf(office, window).filter { it.isNotBlank() }.joinToString(" · "))
    views.setTextViewText(R.id.widget_status, if (hasTicket) status.ifBlank { "ACTIVE" }.uppercase(Locale.getDefault()) else "NO TICKET")
    views.setTextViewText(R.id.widget_ticket, ticket.ifBlank { "--" })
    views.setTextViewText(R.id.widget_serving, serving.ifBlank { "--" })
    views.setTextViewText(R.id.widget_stats,
      if (ahead >= 0 || eta >= 0) "${if (ahead >= 0) ahead else "--"} · ${if (eta >= 0) eta else "--"}m" else "-- · --m")

    val time = if (updatedAt > 0) SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(updatedAt)) else ""
    val footer = footerOverride ?: if (hasTicket) "Updated $time · Tap to open · Status refreshes" else "Open Uniqueue after joining a queue"
    views.setTextViewText(R.id.widget_footer, footer)

    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      action = Intent.ACTION_VIEW
      data = if (ticketId > 0) Uri.parse("uniqueue://student/live-queue?ticketId=$ticketId&queueId=$ticketId") else Uri.parse("uniqueue://")
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    if (launch != null) {
      views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 4100, launch, pendingFlags()))
    }

    val refresh = Intent(context, UniqueueWidgetProvider::class.java).apply { action = ACTION_REFRESH }
    views.setOnClickPendingIntent(R.id.widget_status, PendingIntent.getBroadcast(context, 4101, refresh, pendingFlags()))
    views.setViewVisibility(R.id.widget_footer, View.VISIBLE)
    return views
  }

  private fun refreshFromNetwork(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val pending = goAsync()
    Thread {
      try {
        val p = context.getSharedPreferences(PREFS, 0)
        val ticketId = p.getLong("ticketId", 0L)
        val endpoint = p.getString("endpoint", "").orEmpty()
        if (ticketId <= 0 || endpoint.isBlank()) {
          renderAll(context, manager, ids)
          return@Thread
        }

        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          connectTimeout = 8000
          readTimeout = 8000
          doOutput = true
          setRequestProperty("Content-Type", "application/json")
      setRequestProperty("Authorization", "Bearer " + p.getString("authorization", "").orEmpty())
        }
        connection.outputStream.use { it.write("{\"ticket_id\":$ticketId,\"queue_id\":$ticketId}".toByteArray()) }
        if (connection.responseCode == 401 || connection.responseCode == 403) {
          connection.disconnect()
          p.edit().clear().apply()
          renderCached(context)
          return@Thread
        }
        val raw = (if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream)
          ?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()

        val json = JSONObject(raw)
        if (json.optBoolean("success")) {
          val queue = json.optJSONObject("queue") ?: JSONObject()
          p.edit()
            .putString("ticket", jsonText(queue, "queue_number"))
            .putString("office", jsonText(queue, "office"))
            .putString("window", jsonText(queue, "window"))
            .putString("status", jsonText(queue, "status"))
            .putString("nowServing", jsonText(json, "now_serving"))
            .putInt("peopleAhead", json.optInt("people_ahead", -1))
            .putInt("estimatedWait", json.optInt("estimated_wait", -1))
            .putLong("updatedAt", System.currentTimeMillis())
            .apply()
          renderAll(context, manager, ids)
        } else {
          renderAll(context, manager, ids, "Could not refresh · Tap status to retry")
        }
      } catch (_: Throwable) {
        renderAll(context, manager, ids, "Offline · Tap status to retry")
      } finally {
        scheduleNextRefresh(context)
        pending.finish()
      }
    }.start()
  }
}
