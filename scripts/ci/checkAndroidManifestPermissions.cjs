#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { validateAndroidPermissions } = require('./androidPermissionPolicy.cjs');

const manifestPath = process.argv[2] || 'android/app/src/main/AndroidManifest.xml';
const xml = fs.readFileSync(manifestPath, 'utf8');
const permissions = new Set();
const permissionRegex = /<uses-permission\b[^>]*\bandroid:name="([^"]+)"[^>]*>/g;
let match;
while ((match = permissionRegex.exec(xml)) !== null) permissions.add(match[1]);

const failures = validateAndroidPermissions(permissions)
  .map(failure => `Generated AndroidManifest ${failure}`);

if (failures.length > 0) {
  console.error('Generated AndroidManifest permission gate failed:');
  console.error(failures.map(item => `- ${item}`).join('\n'));
  console.error('\nManifest permissions:');
  console.error([...permissions].sort().map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log('Generated AndroidManifest permission gate passed.');
console.log([...permissions].sort().join('\n'));
