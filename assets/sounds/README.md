# Custom notification sounds

Two files are read by the build. **The file names must stay exactly these**
(they are referenced in `app.json`, `push.ts`, and the server payloads):

| File | Used for | Channel |
| --- | --- | --- |
| `alarm.wav`  | `next_in_line`, `called`, `in_progress` — the "it's your turn" alarm | `proceed_alert_v5` |
| `notify.wav` | position updates, completed, cancelled | `queue_updates_v5` |

## Rules
- **Format:** `.wav` (PCM 16-bit). `.mp3` works on Android but NOT on iOS - stick to wav.
- **Length:** iOS ignores anything **over 30 seconds** and falls back to the default tone.
  Keep `alarm.wav` at 25s or less. Android plays the whole file.
- A notification sound does **not loop**. To make the alarm ring longer, make the *file itself*
  longer (a 25s looping beep, like the starter file here).
- Keep them mono, 44.1 kHz - smaller APK, no OEM playback quirks.

## Replacing them with your own audio
Drop your file in this folder and convert:

```bash
# alarm: trim to 25s, mono, 44.1kHz wav
ffmpeg -i my-alarm.mp3 -t 25 -ar 44100 -ac 1 -acodec pcm_s16le alarm.wav

# short notification chime
ffmpeg -i my-chime.mp3 -t 3 -ar 44100 -ac 1 -acodec pcm_s16le notify.wav
```

## IMPORTANT after changing a sound
An Android channel's sound is **frozen when the channel is first created** - replacing the wav
file alone will NOT change the sound on phones that already installed the app. You must bump
the channel id in `components/notification/push.ts`:

```ts
export const CHANNEL_ALARM = 'proceed_alert_v5';
export const CHANNEL_DEFAULT = 'queue_updates_v5';
const LEGACY_CHANNELS = ['proceed_alert_v4', 'queue_updates_v4', 'proceed_alert_v3', 'queue_updates_v3', 'proceed_alert_v2', 'queue_updates_v2', 'proceed_alert', 'proceed', 'default'];
```

...and bump the same ids in the server files so the push targets the new channel:
- `uniqueue_api/push_helper.php`
- `uniqueue_api/push_notifications.php`
- `uniqueue-web/app/helpers/push_notifications.php`

Then rebuild (`eas build`) - a sound change requires a **new native build**, not just an OTA update.
