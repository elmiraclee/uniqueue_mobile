MOBILE PROFILE PHOTO UPLOAD PATCH

Apply BOTH files to the root of your active Expo mobile project:
- app/student/profile.tsx (replace)
- utils/profile-photo-upload.ts (new)

No PHP, SQL, API address, server permissions or dependency changes are required.
Keep existing deployment/configuration and session storage.

What changed:
- Dedicated XMLHttpRequest multipart photo upload with a 60-second timeout.
- Uses the existing bearer session and configured upload endpoint.
- Lets the runtime generate Content-Type and multipart boundary.
- Handles native file:// and Android content:// photo references.
- Shows distinct photo network, timeout, file, authentication and server errors.
- Does not automatically retry uploads; after a timeout, refresh before retrying.

IMPORTANT: Copying PHP files to the server does not update an installed mobile app.
For Expo Go/development, restart Metro with `npx expo start -c` and reload the app.
For an installed APK/production build, rebuild/reinstall through your existing build workflow (or your configured compatible update workflow).
This ZIP is source code, not an APK.

Test on the device: select a fresh small JPG or PNG from the gallery, upload, refresh,
and confirm the same photo appears on the web. If it fails, report the exact
[PHOTO_...] code and message, device OS, and whether this is Expo Go or an installed APK.
Do not send tokens or credentials.

Validation: both files passed TypeScript syntax transpilation; 22 mocked transport
checks passed. No real Android/iOS upload, full Expo build/typecheck, or live-server
verification was performed. The exact original native-network cause is not yet proven.
