const { createRunOncePlugin, withAndroidManifest } = require('expo/config-plugins');

const FORBIDDEN_MEDIA_PERMISSIONS = new Set([
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.WRITE_EXTERNAL_STORAGE',
]);

const LEGACY_READ_PERMISSION = 'android.permission.READ_EXTERNAL_STORAGE';

function removeForbiddenPermissions(androidManifest) {
  const manifest = androidManifest.manifest;
  const permissionKeys = ['uses-permission', 'uses-permission-sdk-23'];

  for (const key of permissionKeys) {
    const entries = manifest[key];
    if (!Array.isArray(entries)) continue;
    const forbiddenRemovalMarkers = new Set();

    manifest[key] = entries.flatMap(entry => {
      const permissionName = entry?.$?.['android:name'];
      if (FORBIDDEN_MEDIA_PERMISSIONS.has(permissionName)) {
        if (forbiddenRemovalMarkers.has(permissionName)) return [];
        forbiddenRemovalMarkers.add(permissionName);
        return [{
          $: {
            'android:name': permissionName,
            'tools:node': 'remove',
          },
        }];
      }
      if (permissionName !== LEGACY_READ_PERMISSION) return [entry];
      return [{
        ...entry,
        $: {
          ...entry.$,
          'android:maxSdkVersion': '32',
        },
      }];
    });

    if (manifest[key].length === 0) {
      delete manifest[key];
    }
  }

  for (const application of manifest.application ?? []) {
    if (application?.$) delete application.$['android:requestLegacyExternalStorage'];
  }

  return androidManifest;
}

function withExpoSystemAudio(config) {
  return withAndroidManifest(config, config => {
    config.modResults = removeForbiddenPermissions(config.modResults);
    return config;
  });
}

const plugin = createRunOncePlugin(
  withExpoSystemAudio,
  'expo-system-audio',
  '1.0.0',
);

module.exports = plugin;
module.exports.FORBIDDEN_MEDIA_PERMISSIONS = FORBIDDEN_MEDIA_PERMISSIONS;
module.exports.removeForbiddenPermissions = removeForbiddenPermissions;
