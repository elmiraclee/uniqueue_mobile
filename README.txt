UniQueue SDK 58 notification-runtime guard

Scope: modifies ONLY components/notification/push.ts. Keep the previous TypeScript and SecureStore fixes. This does NOT supply missing native code and does NOT enable remote push in Expo Go.

Why the error occurs:
The SDK 58 expo-notifications JavaScript bundle eagerly imports ExpoTopicSubscriptionModule on Android. The running app binary does not expose that module. Expo Go does not support Android remote push; a pre-upgrade development build can also lack the newer native module. Restarting Metro or reinstalling npm packages cannot add compiled native code to a running client.

What changed:
- Uses Expo's official isRunningInExpoGo detector, retaining legacy constant fallbacks.
- Skips native notification-package evaluation in Expo Go and web.
- Before evaluating the package in a custom native build, probes SDK 58's required native modules with requireOptionalNativeModule, including the Android-only topic module.
- If capabilities are missing, returns null with one actionable warning, not repeated failing imports.
- Caches the supported package or unsupported result for this JS runtime.
- Leaves the separate API/in-app notification feed and session-storage logic unchanged. In unsupported clients the app intentionally disables its entire system-notification integration, including local system alerts; this does not assert that Expo Go lacks all local-notification support.

Apply (one of these methods, not both):
A. Back up your current components/notification/push.ts. Replace only that file with the same path in this ZIP, merging any custom changes.
B. Copy notifications-runtime.patch to the project root. Run git apply --check notifications-runtime.patch, then only if it succeeds run git apply notifications-runtime.patch. If it does not apply, stop and send your current push.ts.

Then:
  npx tsc --noEmit
  npx expo start --clear
Fully close and reopen the app. No dependency reinstall is required for this guard.

Expo Go/basic app testing:
You can continue basic UI/API testing without this missing-module import. Remote push, headless delivery and custom widget/native alarm capabilities are not certified/available through this guard. Use a development build to test those features.

Full Android notification testing:
1. Complete SDK 58 config/peer checks (npx expo-doctor) and configure Firebase/EAS credentials privately.
2. Rebuild and INSTALL a fresh SDK 58 development client; do not open the project in Expo Go or an old APK.
3. The supplied eas.json already has a development profile with developmentClient:true. An EAS cloud-build command is:
   npx eas-cli@latest build --platform android --profile development
   This is optional user-run work: it requires your account/project setup, credentials and potentially build credits. No build was submitted here.
4. Install the resulting Android app, then connect it to:
   npx expo start --dev-client --clear
5. Validate notifications on your device, permissions, channels, push-token registration and delivery. The custom widget and native alarms require their own testing.

Local Android builds are another option if the Android SDK/JDK are set up. If android/ or ios/ are tracked, review the native SDK upgrade and custom module/config integration; do not run prebuild --clean blindly or delete native customizations. EAS also uses tracked native folders, so an old native project is not automatically migrated merely by changing package.json.

Do NOT try to npm-install ExpoTopicSubscriptionModule as a standalone package. Do not suppress all logs or weaken authentication/storage to work around this error. If a freshly rebuilt app still reports missing modules, inspect native autolinking/build logs.

Validation:
- Full tsc --noEmit passed (zero errors) on the SDK58 compatibility-patched supplied source, with the SecureStore key fix retained.
- 10 mocked runtime scenarios passed: official/legacy Expo Go detection, web skip, missing Android topic/common module, supported Android/iOS, capability failure and unexpected import failure. Unsupported scenarios do not evaluate expo-notifications; repeated calls do not repeat warnings/import attempts.
- Guard names cover all 13 native requireNativeModule names found in the installed SDK58 expo-notifications native/Android modules; topic module is Android-only.
- No real Expo Go/Android/iOS/device/native build or live push delivery test was performed. This is graceful capability handling, not native feature enablement.
