#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageLockPath = path.join(repoRoot, 'package-lock.json');
const manifestPath = path.join(repoRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const permissionGate = path.join(__dirname, 'checkAndroidManifestPermissions.cjs');
const expoBin = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'expo.cmd' : 'expo',
);

const readIfExists = file => (fs.existsSync(file) ? fs.readFileSync(file) : undefined);
const restoreFile = (file, content) => {
  if (content === undefined) {
    fs.rmSync(file, { force: true });
    return;
  }

  fs.writeFileSync(file, content);
};

if (!fs.existsSync(expoBin)) {
  console.error(`Expo CLI binary not found at ${expoBin}. Run npm ci before this gate.`);
  process.exit(1);
}

const packageJsonBefore = readIfExists(packageJsonPath);
const packageLockBefore = readIfExists(packageLockPath);
let prebuildStatus = 1;

try {
  const prebuild = spawnSync(
    expoBin,
    ['prebuild', '--platform', 'android', '--no-install', '--clean'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );

  prebuildStatus = prebuild.status ?? 1;
} finally {
  restoreFile(packageJsonPath, packageJsonBefore);
  restoreFile(packageLockPath, packageLockBefore);
}

if (prebuildStatus !== 0) {
  process.exit(prebuildStatus);
}

const gate = spawnSync(process.execPath, [permissionGate, manifestPath], {
  cwd: repoRoot,
  stdio: 'inherit',
});

process.exit(gate.status ?? 1);
