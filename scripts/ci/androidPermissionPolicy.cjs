'use strict';

const REQUIRED_ANDROID_PERMISSIONS = Object.freeze([
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
]);

/**
 * Explicit release allowlist. Keep this list intentionally small and review
 * every addition against the feature that requires it. The legacy storage
 * permissions remain permitted for supported pre-Android-13 devices; scoped
 * storage/SAF still governs actual access on modern Android versions.
 */
const ALLOWED_ANDROID_PERMISSIONS = Object.freeze([
  ...REQUIRED_ANDROID_PERMISSIONS,
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.WAKE_LOCK',
  'android.permission.VIBRATE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
]);

const FORBIDDEN_ANDROID_PERMISSIONS = Object.freeze([
  'android.permission.RECORD_AUDIO',
  'android.permission.CAMERA',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
]);

const validateAndroidPermissions = permissions => {
  const actual = new Set(permissions);
  const allowed = new Set(ALLOWED_ANDROID_PERMISSIONS);
  const forbidden = new Set(FORBIDDEN_ANDROID_PERMISSIONS);
  const failures = [];

  for (const permission of REQUIRED_ANDROID_PERMISSIONS) {
    if (!actual.has(permission)) failures.push(`missing required permission: ${permission}`);
  }

  for (const permission of [...actual].sort()) {
    if (forbidden.has(permission)) {
      failures.push(`contains forbidden permission: ${permission}`);
    } else if (!allowed.has(permission)) {
      failures.push(`contains unexpected permission outside the release allowlist: ${permission}`);
    }
  }

  return failures;
};

module.exports = {
  REQUIRED_ANDROID_PERMISSIONS,
  ALLOWED_ANDROID_PERMISSIONS,
  FORBIDDEN_ANDROID_PERMISSIONS,
  validateAndroidPermissions,
};
