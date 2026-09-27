/*
|--------------------------------------------------------------------------
| Dynamic Expo config
|--------------------------------------------------------------------------
| Everything still lives in app.json. This file only overrides the one
| value EAS Build cannot read from git: the FCM google-services.json.
|
| Locally  -> falls back to ./google-services.json (untracked file on disk)
| On EAS   -> uses the path EAS writes for the GOOGLE_SERVICES_JSON
|             file-type environment variable.
|
| Without this file (or without committing google-services.json) the build
| fails with: "google-services.json" is missing.
*/
const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = { ...appJson.expo, ...config };

  return {
    ...base,
    android: {
      ...base.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  };
};
