package com.uniqueue.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class UniqueueBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (
      intent?.action == Intent.ACTION_BOOT_COMPLETED ||
      intent?.action == Intent.ACTION_MY_PACKAGE_REPLACED
    ) {
      // Android 15+ forbids starting a dataSync foreground service from
      // BOOT_COMPLETED, so only re-arm the widget refresh there. The live
      // service starts again the next time the app/widget updates the ticket.
      if (Build.VERSION.SDK_INT >= 35) {
        UniqueueWidgetProvider.scheduleNextRefresh(context)
      } else {
        UniqueueRealtimeService.start(context)
      }
    }
  }
}
