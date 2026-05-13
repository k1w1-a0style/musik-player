const { createRunOncePlugin, withAndroidManifest } = require('expo/config-plugins');

const FORBIDDEN_MEDIA_PERMISSIONS = new Set([
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
]);

function removeForbiddenPermissions(androidManifest) {
  const manifest = androidManifest.manifest;
  const permissionKeys = ['uses-permission', 'uses-permission-sdk-23'];

  for (const key of permissionKeys) {
    const entries = manifest[key];
    if (!Array.isArray(entries)) continue;

    manifest[key] = entries.filter(entry => {
      const permissionName = entry?.$?.['android:name'];
      return !FORBIDDEN_MEDIA_PERMISSIONS.has(permissionName);
    });

    if (manifest[key].length === 0) {
      delete manifest[key];
    }
  }

  return androidManifest;
}

function withExpoSystemAudio(config) {
  return withAndroidManifest(config, config => {
    config.modResults = removeForbiddenPermissions(config.modResults);
    return config;
  });
}

module.exports = createRunOncePlugin(
  withExpoSystemAudio,
  'expo-system-audio',
  '1.0.0',
);
