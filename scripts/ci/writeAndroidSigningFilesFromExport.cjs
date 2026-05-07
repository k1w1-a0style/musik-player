#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

function fail(msg) {
  process.stderr.write(`::error::${msg}\n`);
  process.exit(1);
}

function addMask(value) {
  if (!value) return;
  process.stdout.write(`::add-mask::${value}\n`);
}

function normalizeBase64(input) {
  return String(input || '').replace(/\s+/g, '');
}

function decodeValidatedBase64(input) {
  const normalized = normalizeBase64(input);
  if (!normalized) fail('keystoreBase64 is empty after whitespace normalization.');
  if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) fail('keystoreBase64 contains invalid characters.');
  if (normalized.length % 4 !== 0) fail('keystoreBase64 length must be divisible by 4.');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) fail('keystoreBase64 has invalid padding.');
  const buf = Buffer.from(normalized, 'base64');
  if (!buf || buf.length < 32) fail('Decoded keystore data is empty or too small.');
  const reencoded = buf.toString('base64').replace(/=+$/g, '');
  const sourceNoPad = normalized.replace(/=+$/g, '');
  if (reencoded !== sourceNoPad) fail('keystoreBase64 validation failed (re-encode mismatch).');
  return buf;
}

(async () => {
  try {
    const stdin = await new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', reject);
    });

    if (!stdin.trim()) fail('Keystore export input is empty (expected JSON on stdin).');

    let parsed;
    try {
      parsed = JSON.parse(stdin);
    } catch {
      fail('Invalid JSON from keystore export endpoint.');
    }

    const keystoreBase64 = String(parsed.keystoreBase64 || '').trim();
    const keystorePassword = String(parsed.keystorePassword || '').trim();
    const alias = String(parsed.alias || '').trim();
    const keyPassword = String(parsed.keyPassword || '').trim();

    if (!keystoreBase64 || !keystorePassword || !alias || !keyPassword) {
      fail('Missing required fields: keystoreBase64, keystorePassword, alias, keyPassword.');
    }

    addMask(keystoreBase64);
    addMask(keystorePassword);
    addMask(alias);
    addMask(keyPassword);

    const outDir = process.cwd();
    const logDir = path.join(process.cwd(), 'ci-logs');
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(logDir, { recursive: true });

    const keystorePath = path.join(outDir, 'android-upload-keystore.p12');
    const credentialsJsonPath = path.join(outDir, 'credentials.json');
    const summaryPath = path.join(logDir, 'keystore-summary.json');

    const keystoreBuffer = decodeValidatedBase64(keystoreBase64);

    fs.writeFileSync(keystorePath, keystoreBuffer, { mode: 0o600 });
    fs.chmodSync(keystorePath, 0o600);

    const credentialsJson = {
      android: {
        keystore: {
          keystorePath: 'android-upload-keystore.p12',
          keystorePassword,
          keyAlias: alias,
          keyPassword,
        },
      },
    };
    fs.writeFileSync(credentialsJsonPath, JSON.stringify(credentialsJson, null, 2), { mode: 0o600 });
    fs.chmodSync(credentialsJsonPath, 0o600);

    const summary = {
      writtenAtUtc: new Date().toISOString(),
      keystorePath,
      credentialsJsonPath,
      keystoreBytes: keystoreBuffer.length,
      aliasPreview: alias.length <= 4 ? '***' : `${alias.slice(0, 2)}***${alias.slice(-2)}`,
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), { mode: 0o600 });

    process.stdout.write('Wrote Android signing files in project root for EAS local credentials.\n');
    process.stdout.write(`Summary written to ${summaryPath}\n`);
  } catch (err) {
    fail(`Unexpected error while writing Android signing files: ${err instanceof Error ? err.message : String(err)}`);
  }
})();
