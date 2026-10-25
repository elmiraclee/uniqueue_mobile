package com.uniqueue.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UniqueueWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("UniqueueWidget")

    AsyncFunction("update") { data: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val prefs = context.getSharedPreferences(UniqueueWidgetProvider.PREFS, 0)
      prefs.edit()
        .putLong("ticketId", (data["ticketId"] as? Number)?.toLong() ?: 0L)
        .putString("endpoint", data["endpoint"]?.toString().orEmpty())
        .putString("authorization", data["authorization"]?.toString().orEmpty())
        .putString("ticket", data["ticket"]?.toString().orEmpty())
        .putString("office", data["office"]?.toString().orEmpty())
        .putString("window", data["window"]?.toString().orEmpty())
        .putString("status", data["status"]?.toString().orEmpty())
        .putString("nowServing", data["nowServing"]?.toString().orEmpty())
        .putInt("peopleAhead", (data["peopleAhead"] as? Number)?.toInt() ?: -1)
        .putInt("estimatedWait", (data["estimatedWait"] as? Number)?.toInt() ?: -1)
        .putLong("updatedAt", System.currentTimeMillis())
        .apply()
      broadcastUpdate(context, false)
      UniqueueWidgetProvider.scheduleNextRefresh(context)
      UniqueueRealtimeService.start(context)
      true
    }

    AsyncFunction("refresh") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      broadcastUpdate(context, true)
      true
    }

    AsyncFunction("clear") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      context.getSharedPreferences(UniqueueWidgetProvider.PREFS, 0).edit().clear().apply()
      UniqueueWidgetProvider.cancelScheduledRefresh(context)
      UniqueueRealtimeService.stop(context)
      broadcastUpdate(context, false)
      true
    }

    AsyncFunction("vibrateAlarm") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.getSystemService(VibratorManager::class.java).defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(android.content.Context.VIBRATOR_SERVICE) as Vibrator
      }
      if (!vibrator.hasVibrator()) return@AsyncFunction false

      // Native 15-second alarm pattern. Unlike React Native timers, this
      // keeps running while the app UI is backgrounded.
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
      true
    }
  }

  private fun broadcastUpdate(context: android.content.Context, refresh: Boolean) {
    val manager = AppWidgetManager.getInstance(context)
    val component = ComponentName(context, UniqueueWidgetProvider::class.java)
    val ids = manager.getAppWidgetIds(component)
    val intent = Intent(context, UniqueueWidgetProvider::class.java).apply {
      action = if (refresh) UniqueueWidgetProvider.ACTION_REFRESH else AppWidgetManager.ACTION_APPWIDGET_UPDATE
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
    }
    context.sendBroadcast(intent)
  }
}
