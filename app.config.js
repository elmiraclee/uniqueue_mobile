/*
|--------------------------------------------------------------------------
| Dynamic Expo config
|--------------------------------------------------------------------------
| Everything still lives in app.json. This file applies the generated deployment profile and the FCM
| google-services.json location. Profile changes require a new native build.
|
| Locally  -> falls back to ./google-services.json (untracked file on disk)
| On EAS   -> uses the path EAS writes for the GOOGLE_SERVICES_JSON
|             file-type environment variable.
|
| Without this file (or without committing google-services.json) the build
| fails with: "google-services.json" is missing.
*/
const appJson = require('./app.json');
const deployment = require('./deployment.generated.json');

module.exports = ({ config }) => {
  const base = { ...appJson.expo, ...config };

  const plugins = (base.plugins || []).map((p) =>
    Array.isArray(p) && p[0] === 'expo-build-properties'
      ? [p[0], { ...p[1], android: { ...p[1]?.android, usesCleartextTraffic: !!deployment.allow_insecure_http } }]
      : p);
  return {
    ...base,
    plugins,
    extra: { ...base.extra, deploymentProfile: deployment.profile },
    android: {
      ...base.android,
      usesCleartextTraffic: !!deployment.allow_insecure_http,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  };
};
