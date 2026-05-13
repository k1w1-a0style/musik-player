/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

const configPath = process.argv[2] || 'expo-config.json';
const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const config = raw.expo ?? raw;

const failures = [];
const expectEqual = (label, actual, expected) => {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

expectEqual('name', config.name, 'Kiwi');
expectEqual('scheme', config.scheme, 'musik-player');
expectEqual('slug', config.slug, 'musik-player');
expectEqual('android.package', config.android?.package, 'com.k1w1a0style.musikplayer');
expectEqual('newArchEnabled', config.newArchEnabled, false);

const androidPermissions = config.android?.permissions ?? [];
const blockedPermissions = config.android?.blockedPermissions ?? [];
const requiredAndroidPermissions = [
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];
const forbiddenAndroidPermissions = [
  'android.permission.RECORD_AUDIO',
];
const requiredBlockedPermissions = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
];

for (const permission of requiredAndroidPermissions) {
  if (!androidPermissions.includes(permission)) failures.push(`Required Android permission missing: ${permission}`);
}

for (const permission of forbiddenAndroidPermissions) {
  if (androidPermissions.includes(permission)) failures.push(`Forbidden Android permission declared: ${permission}`);
}

for (const permission of requiredBlockedPermissions) {
  if (!blockedPermissions.includes(permission)) failures.push(`Android blocked permission missing: ${permission}`);
}

if (config.ios?.infoPlist?.NSMicrophoneUsageDescription != null) {
  failures.push('Forbidden iOS microphone usage description declared: NSMicrophoneUsageDescription');
}

const projectId = config.extra?.eas?.projectId;
if (!projectId || typeof projectId !== 'string') failures.push('Missing expo.extra.eas.projectId');

if (failures.length > 0) {
  console.error(failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log('Expo config release gate passed.');
