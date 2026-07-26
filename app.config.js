const fs = require('fs');
const path = require('path');

function readJson(rel) {
  try {
    const p = path.join(__dirname, rel);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

const eas = readJson('eas-project.json');
const easProjectId = eas && eas.projectId ? String(eas.projectId) : undefined;

module.exports = ({ config }) => {
  const base = config || readJson('app.json') || {};
  const profile = process.env.EAS_BUILD_PROFILE || '';
  const isDevelopmentBuild = profile === 'development';

  const extra = { ...(base.extra || {}) };
  const easExtra = { ...(extra.eas || {}) };
  if (!easExtra.projectId && easProjectId) easExtra.projectId = easProjectId;
  extra.eas = easExtra;

  const android = { ...(base.android || {}) };
  if (isDevelopmentBuild) {
    android.package = 'com.k1w1a0style.musikplayer.dev';
  }

  const blockedPermissions = new Set(
    Array.isArray(android.blockedPermissions) ? android.blockedPermissions : [],
  );
  if (!isDevelopmentBuild) {
    [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
    ].forEach(permission => blockedPermissions.add(permission));
  }
  android.blockedPermissions = [...blockedPermissions];

  return {
    ...base,
    android,
    extra,
  };
};
