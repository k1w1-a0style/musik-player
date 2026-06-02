#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const tools = new Map();

const fail = message => {
  console.error(`error: ${message}`);
  process.exit(1);
};

const parseCliArgs = argv => {
  const options = { apkPath: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) fail(`Missing value for ${arg}`);
      return argv[i];
    };

    switch (arg) {
      case '--expected-package':
        options.expectedPackage = next();
        break;
      case '--expected-label':
        options.expectedLabel = next();
        break;
      case '--min-size-bytes':
        options.minSizeBytes = Number(next());
        if (!Number.isFinite(options.minSizeBytes) || options.minSizeBytes < 0) fail(`Invalid --min-size-bytes value: ${argv[i]}`);
        break;
      case '--require-badging':
        options.requireBadging = true;
        break;
      case '--require-signature':
        options.requireSignature = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) fail(`Unknown option: ${arg}`);
        if (options.apkPath) fail(`Unexpected extra argument: ${arg}`);
        options.apkPath = arg;
        break;
    }
  }
  return options;
};

const usage = () => [
  'Usage: node scripts/ci/inspectAndroidApk.cjs <path-to.apk> [options]',
  '',
  'Options:',
  '  --expected-package <package>  Fail unless aapt/aapt2 reports this package name.',
  '  --expected-label <label>      Fail unless aapt/aapt2 reports this application label.',
  '  --min-size-bytes <bytes>      Fail unless APK size is at least this many bytes.',
  '  --require-badging             Fail if aapt/aapt2 metadata cannot be read.',
  '  --require-signature           Fail if apksigner is missing or verification fails.',
].join('\n');

const candidateSdkToolPaths = name => {
  const roots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean);
  const candidates = [];
  for (const root of roots) {
    const buildToolsDir = path.join(root, 'build-tools');
    if (!fs.existsSync(buildToolsDir)) continue;
    for (const version of fs.readdirSync(buildToolsDir).sort().reverse()) {
      candidates.push(path.join(buildToolsDir, version, name));
    }
  }
  return candidates;
};

const findTool = name => {
  if (tools.has(name)) return tools.get(name);
  const result = spawnSync('bash', ['-lc', `command -v ${name}`], { encoding: 'utf8' });
  const fromPath = result.status === 0 ? result.stdout.trim().split('\n')[0] : '';
  if (fromPath) {
    tools.set(name, fromPath);
    return fromPath;
  }

  for (const candidate of candidateSdkToolPaths(name)) {
    if (fs.existsSync(candidate)) {
      tools.set(name, candidate);
      return candidate;
    }
  }

  tools.set(name, '');
  return '';
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

const parseColonQuotedValue = (line, prefix) => {
  const match = line.match(new RegExp(`^${prefix}:'([^']*)'$`));
  return match ? match[1] : undefined;
};

const parseNativeCode = line => {
  const abis = [];
  const re = /'([^']+)'/g;
  let match;
  while ((match = re.exec(line)) !== null) abis.push(match[1]);
  return abis.join(',');
};

const parseBadging = output => {
  const data = { permissions: [] };
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('package:')) Object.assign(data, parseAttributes(line));
    if (line.startsWith('application-label:')) data.applicationLabel = parseColonQuotedValue(line, 'application-label');
    if (line.startsWith('sdkVersion:')) data.minSdkVersion = parseColonQuotedValue(line, 'sdkVersion');
    if (line.startsWith('targetSdkVersion:')) data.targetSdkVersion = parseColonQuotedValue(line, 'targetSdkVersion');
    if (line.startsWith('native-code:')) data.nativeCode = parseNativeCode(line);
    if (line.startsWith('uses-permission:')) {
      const name = parseAttributes(line).name;
      if (name) data.permissions.push(name);
    }
  }
  return data;
};

const listZip = apkPath => {
  const unzip = findTool('unzip');
  if (!unzip) return null;
  const result = run(unzip, ['-Z1', apkPath]);
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).filter(Boolean);
};

const validateBadging = (badging, options) => {
  const failures = [];
  if (options.expectedPackage && badging.name !== options.expectedPackage) {
    failures.push(`packageName expected ${JSON.stringify(options.expectedPackage)}, got ${JSON.stringify(badging.name)}`);
  }
  if (options.expectedLabel && badging.applicationLabel !== options.expectedLabel) {
    failures.push(`applicationLabel expected ${JSON.stringify(options.expectedLabel)}, got ${JSON.stringify(badging.applicationLabel)}`);
  }
  if (!badging.minSdkVersion) failures.push('minSdkVersion missing from aapt/aapt2 output');
  if (!badging.targetSdkVersion) failures.push('targetSdkVersion missing from aapt/aapt2 output');
  return failures;
};

const inspectApk = options => {
  const apkPath = options.apkPath;
  if (!apkPath) fail(usage());
  if (!fs.existsSync(apkPath)) fail(`APK not found: ${apkPath}`);
  const stat = fs.statSync(apkPath);
  if (!stat.isFile()) fail(`APK path is not a file: ${apkPath}`);
  if (stat.size <= 0) fail(`APK is empty: ${apkPath}`);
  if (options.minSizeBytes != null && stat.size < options.minSizeBytes) {
    fail(`APK size ${stat.size} is below required minimum ${options.minSizeBytes}`);
  }

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

  const zipEntries = listZip(apkPath);
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
    const result = run(aapt, ['dump', 'badging', apkPath]);
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
      const failures = validateBadging(badging, options);
      if (failures.length > 0) {
        console.error(failures.map(item => `error: ${item}`).join('\n'));
        process.exit(1);
      }
    } else {
      const message = `${path.basename(aapt)} dump badging failed; APK metadata unavailable`;
      if (options.requireBadging) {
        console.error(`error: ${message}`);
        const details = `${result.stdout}${result.stderr}`.trim();
        if (details) console.log(details);
        process.exit(1);
      }
      warn(message);
      const details = `${result.stdout}${result.stderr}`.trim();
      if (details) console.log(details);
    }
  } else if (options.requireBadging) {
    fail('aapt/aapt2 not found; required APK metadata checks cannot run');
  } else {
    warn('aapt/aapt2 not found; skipping package, label, version, SDK, native-code, and permissions metadata');
  }

  const apksigner = findTool('apksigner');
  if (apksigner) {
    const result = run(apksigner, ['verify', '--verbose', apkPath]);
    const signatureVerified = result.status === 0;
    info('signatureStatus', signatureVerified ? 'verified' : 'failed');
    const details = `${result.stdout}${result.stderr}`.trim();
    if (details) console.log(details);
    if (!signatureVerified) {
      if (options.requireSignature) process.exit(1);
      warn('APK signature verification failed; continuing because --require-signature was not set');
    }
  } else if (options.requireSignature) {
    fail('apksigner not found; required APK signature verification cannot run');
  } else {
    warn('apksigner not found; skipping APK signature verification');
  }
};

if (require.main === module) {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }
  inspectApk(options);
}

module.exports = {
  parseAttributes,
  parseBadging,
  parseNativeCode,
  inspectApk,
};
