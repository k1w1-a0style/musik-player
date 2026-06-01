const fs = require('fs');

const manifestPath = process.argv[2] || 'android/app/src/main/AndroidManifest.xml';
const xml = fs.readFileSync(manifestPath, 'utf8');
const permissions = new Set();
const permissionRegex = /<uses-permission\b[^>]*\bandroid:name="([^"]+)"[^>]*>/g;
let match;
while ((match = permissionRegex.exec(xml)) !== null) {
  permissions.add(match[1]);
}

const required = [
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];
const forbidden = [
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
];

const failures = [];
for (const permission of required) {
  if (!permissions.has(permission)) failures.push(`Generated AndroidManifest is missing required permission: ${permission}`);
}
for (const permission of forbidden) {
  if (permissions.has(permission)) failures.push(`Generated AndroidManifest contains forbidden permission: ${permission}`);
}

if (failures.length > 0) {
  console.error('Generated AndroidManifest permission gate failed:');
  console.error(failures.map(item => `- ${item}`).join('\n'));
  console.error('\nManifest permissions:');
  console.error([...permissions].sort().map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log('Generated AndroidManifest permission gate passed.');
console.log([...permissions].sort().join('\n'));
