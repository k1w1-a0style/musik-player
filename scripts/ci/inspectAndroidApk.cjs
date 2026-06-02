#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const apkPath = process.argv[2];
const fail = message => {
  console.error(`error: ${message}`);
  process.exit(1);
};

if (!apkPath) fail('Usage: node scripts/ci/inspectAndroidApk.cjs <path-to.apk>');
if (!fs.existsSync(apkPath)) fail(`APK not found: ${apkPath}`);
const stat = fs.statSync(apkPath);
if (!stat.isFile()) fail(`APK path is not a file: ${apkPath}`);
if (stat.size <= 0) fail(`APK is empty: ${apkPath}`);

const tools = new Map();
const findTool = name => {
  if (tools.has(name)) return tools.get(name);
  const result = spawnSync('bash', ['-lc', `command -v ${name}`], { encoding: 'utf8' });
  const found = result.status === 0 ? result.stdout.trim().split('\n')[0] : '';
  tools.set(name, found);
  return found;
};

const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const warn = message => console.log(`warning: ${message}`);
const info = (key, value) => console.log(`${key}: ${value == null || value === '' ? 'unknown' : value}`);

const parseAttributes = line => {
  const out = {};
  const re = /([A-Za-z0-9_.-]+)='([^']*)'/g;
  let match;
  while ((match = re.exec(line)) !== null) out[match[1]] = match[2];
  return out;
};

const parseBadging = output => {
  const data = { permissions: [] };
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('package:')) Object.assign(data, parseAttributes(line));
    if (line.startsWith('application-label:')) data.applicationLabel = parseAttributes(line)['application-label'];
    if (line.startsWith('sdkVersion:')) data.minSdkVersion = parseAttributes(line).sdkVersion;
    if (line.startsWith('targetSdkVersion:')) data.targetSdkVersion = parseAttributes(line).targetSdkVersion;
    if (line.startsWith('native-code:')) data.nativeCode = line.replace(/^native-code:\s*/, '').trim().replace(/'/g, '');
    if (line.startsWith('uses-permission:')) {
      const name = parseAttributes(line).name;
      if (name) data.permissions.push(name);
    }
  }
  return data;
};

const listZip = () => {
  const unzip = findTool('unzip');
  if (!unzip) return null;
  const result = run(unzip, ['-Z1', apkPath]);
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).filter(Boolean);
};

console.log(`APK inspection: ${path.resolve(apkPath)}`);
info('sizeBytes', stat.size);

const unzip = findTool('unzip');
if (unzip) {
  const test = run(unzip, ['-t', apkPath]);
  info('zipIntegrity', test.status === 0 ? 'ok' : 'failed');
  if (test.status !== 0) {
    const details = `${test.stdout}${test.stderr}`.trim();
    if (details) console.log(details);
    process.exit(1);
  }
} else {
  warn('unzip not found; skipping ZIP integrity check');
}

const zipEntries = listZip();
if (zipEntries) {
  const hasAndroidManifestXml = zipEntries.includes('AndroidManifest.xml');
  const hasClassesDex = zipEntries.some(entry => /^classes(\d*)\.dex$/.test(entry));
  info('hasAndroidManifestXml', hasAndroidManifestXml ? 'yes' : 'no');
  info('hasClassesDex', hasClassesDex ? 'yes' : 'no');
  if (!hasAndroidManifestXml || !hasClassesDex) {
    console.error('error: APK is missing required AndroidManifest.xml or classes.dex entries');
    process.exit(1);
  }
  const abiSet = new Set();
  for (const entry of zipEntries) {
    const match = entry.match(/^lib\/([^/]+)\/[^/]+\.so$/);
    if (match) abiSet.add(match[1]);
  }
  info('nativeLibAbis', abiSet.size ? [...abiSet].sort().join(',') : 'none');
} else {
  warn('Could not list APK entries; skipping manifest/classes.dex/native library presence checks');
}

const aapt = findTool('aapt') || findTool('aapt2');
if (aapt) {
  const args = path.basename(aapt) === 'aapt2' ? ['dump', 'badging', apkPath] : ['dump', 'badging', apkPath];
  const result = run(aapt, args);
  if (result.status === 0) {
    const badging = parseBadging(result.stdout);
    info('packageName', badging.name);
    info('applicationLabel', badging.applicationLabel);
    info('versionCode', badging.versionCode);
    info('versionName', badging.versionName);
    info('minSdkVersion', badging.minSdkVersion);
    info('targetSdkVersion', badging.targetSdkVersion);
    info('nativeCode', badging.nativeCode || 'none');
    info('permissions', badging.permissions.length ? badging.permissions.sort().join(',') : 'none');
  } else {
    warn(`${path.basename(aapt)} dump badging failed; APK metadata unavailable`);
    const details = `${result.stdout}${result.stderr}`.trim();
    if (details) console.log(details);
  }
} else {
  warn('aapt/aapt2 not found; skipping package, label, version, SDK, native-code, and permissions metadata');
}

const apksigner = findTool('apksigner');
if (apksigner) {
  const result = run(apksigner, ['verify', '--verbose', apkPath]);
  info('signatureStatus', result.status === 0 ? 'verified' : 'failed');
  const details = `${result.stdout}${result.stderr}`.trim();
  if (details) console.log(details);
  if (result.status !== 0) process.exit(1);
} else {
  warn('apksigner not found; skipping APK signature verification');
}
