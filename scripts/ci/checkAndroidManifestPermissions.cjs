#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { validateAndroidPermissions } = require('./androidPermissionPolicy.cjs');

const manifestPath = process.argv[2] || 'android/app/src/main/AndroidManifest.xml';
const xml = fs.readFileSync(manifestPath, 'utf8');
const permissions = new Set();
const permissionEntries = [];
const permissionRegex = /<uses-permission\b[^>]*>/g;
let match;
while ((match = permissionRegex.exec(xml)) !== null) {
  const tag = match[0];
  if (/\btools:node="remove"/.test(tag)) continue;
  const name = tag.match(/\bandroid:name="([^"]+)"/)?.[1];
  if (name) {
    permissions.add(name);
    permissionEntries.push({
      name,
      maxSdkVersion: tag.match(/\bandroid:maxSdkVersion="([^"]+)"/)?.[1],
    });
  }
}

const failures = validateAndroidPermissions(permissions)
  .map(failure => `Generated AndroidManifest ${failure}`);
if (permissionEntries.some(entry =>
  entry.name === 'android.permission.READ_EXTERNAL_STORAGE'
  && entry.maxSdkVersion !== '32')) {
  failures.push(
    'Generated AndroidManifest legacy permission android.permission.READ_EXTERNAL_STORAGE must declare android:maxSdkVersion="32"',
  );
}
if (/\bandroid:requestLegacyExternalStorage\s*=/.test(xml)) {
  failures.push('Generated AndroidManifest must not declare android:requestLegacyExternalStorage');
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
