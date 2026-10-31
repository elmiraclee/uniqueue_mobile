# Queue alert sounds

Keep `alarm.wav` and `notify.wav` as PCM WAV files, mono 44.1 kHz. They are bundled by the expo-notifications plugin. Keep each under 30 seconds for iOS.

| Sound | Use | Android channel |
| --- | --- | --- |
| alarm.wav | Called / in_progress actual-turn alarm | proceed_alert_v6 |
| notify.wav | Next-in-line and ordinary queue updates | queue_updates_v6 |

Foreground countdown positions 5, 4, 3, 2, 1 use the shared queue-alert owner for short audio and vibration cues. Actual turn uses a bounded alarm; acknowledgement stops it. Background notifications use the OS channel sound after authenticated validation of a fresh data-push event.

Channels respect DND, silent mode, notification permissions and OS restrictions. Data-only background delivery is best-effort, not a guaranteed wake-up alarm. Test on actual target phones.

Changing channel sounds requires a new channel ID in `components/notification/push.ts` and the matching server helper, plus a new native build. It is not an OTA-only change. Legacy v5 channels are retired.
