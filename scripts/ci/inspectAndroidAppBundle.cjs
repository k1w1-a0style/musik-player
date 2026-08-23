#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const fail = message => {
  console.error(`error: ${message}`);
  process.exit(1);
};

const parseCliArgs = argv => {
  const options = { bundlePath: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) fail(`Missing value for ${arg}`);
      return argv[i];
    };

    switch (arg) {
      case '--min-size-bytes':
        options.minSizeBytes = Number(next());
        if (!Number.isFinite(options.minSizeBytes) || options.minSizeBytes < 0) {
          fail(`Invalid --min-size-bytes value: ${argv[i]}`);
        }
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
        if (options.bundlePath) fail(`Unexpected extra argument: ${arg}`);
        options.bundlePath = arg;
        break;
    }
  }
  return options;
};

const usage = () => [
  'Usage: node scripts/ci/inspectAndroidAppBundle.cjs <path-to.aab> [options]',
  '',
  'Options:',
  '  --min-size-bytes <bytes>  Fail unless the App Bundle is at least this large.',
  '  --require-signature       Fail unless jarsigner verifies a signed bundle.',
].join('\n');

const run = (command, args) => spawnSync(command, args, {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

const info = (key, value) => console.log(`${key}: ${value}`);

const inspectAndroidAppBundle = options => {
  const bundlePath = options.bundlePath;
  if (!bundlePath) fail(usage());
  if (path.extname(bundlePath).toLowerCase() !== '.aab') fail(`Expected an .aab file: ${bundlePath}`);
  if (!fs.existsSync(bundlePath)) fail(`Android App Bundle not found: ${bundlePath}`);

  const stat = fs.statSync(bundlePath);
  if (!stat.isFile()) fail(`Android App Bundle path is not a file: ${bundlePath}`);
  if (stat.size <= 0) fail(`Android App Bundle is empty: ${bundlePath}`);
  if (options.minSizeBytes != null && stat.size < options.minSizeBytes) {
    fail(`Android App Bundle size ${stat.size} is below required minimum ${options.minSizeBytes}`);
  }

  console.log(`Android App Bundle inspection: ${path.resolve(bundlePath)}`);
  info('sizeBytes', stat.size);

  const integrity = run('unzip', ['-t', bundlePath]);
  if (integrity.error?.code === 'ENOENT') fail('unzip not found; required App Bundle integrity checks cannot run');
  info('zipIntegrity', integrity.status === 0 ? 'ok' : 'failed');
  if (integrity.status !== 0) {
    const details = `${integrity.stdout}${integrity.stderr}`.trim();
    if (details) console.log(details);
    process.exit(1);
  }

  const listing = run('unzip', ['-Z1', bundlePath]);
  if (listing.status !== 0) fail('Could not list Android App Bundle entries');
  const entries = listing.stdout.split(/\r?\n/).filter(Boolean);
  const requiredEntries = [
    'BundleConfig.pb',
    'base/manifest/AndroidManifest.xml',
  ];
  const missingEntries = requiredEntries.filter(entry => !entries.includes(entry));
  const hasBaseDex = entries.some(entry => /^base\/dex\/classes\d*\.dex$/.test(entry));
  info('hasBundleConfig', entries.includes('BundleConfig.pb') ? 'yes' : 'no');
  info('hasBaseManifest', entries.includes('base/manifest/AndroidManifest.xml') ? 'yes' : 'no');
  info('hasBaseDex', hasBaseDex ? 'yes' : 'no');
  if (missingEntries.length > 0 || !hasBaseDex) {
    fail(`Android App Bundle is missing required entries: ${[
      ...missingEntries,
      ...(hasBaseDex ? [] : ['base/dex/classes*.dex']),
    ].join(', ')}`);
  }

  // Android upload keys are normally self-signed. Verify the JAR signature
  // itself without treating the absence of a public CA trust chain as damage.
  const signature = run('jarsigner', ['-verify', bundlePath]);
  if (signature.error?.code === 'ENOENT') {
    if (options.requireSignature) fail('jarsigner not found; required App Bundle signature checks cannot run');
    info('signatureStatus', 'unavailable');
    return;
  }
  const signatureOutput = `${signature.stdout}${signature.stderr}`;
  const signatureVerified = signature.status === 0 && /jar verified[.!]/i.test(signatureOutput);
  info('signatureStatus', signatureVerified ? 'verified' : 'failed');
  if (!signatureVerified && options.requireSignature) {
    const details = signatureOutput.trim();
    if (details) console.log(details);
    process.exit(1);
  }
  if (!signatureVerified) {
    console.log('warning: App Bundle signature verification failed; continuing because --require-signature was not set');
  }
};

if (require.main === module) {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }
  inspectAndroidAppBundle(options);
}

module.exports = { inspectAndroidAppBundle, parseCliArgs };
