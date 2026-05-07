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

    const outDir = path.join(process.cwd(), 'ci-credentials', 'android');
    const logDir = path.join(process.cwd(), 'ci-logs');
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(logDir, { recursive: true });

    const keystorePath = path.join(outDir, 'release-signing.jks');
    const credentialsJsonPath = path.join(outDir, 'credentials.json');
    const summaryPath = path.join(logDir, 'keystore-summary.json');

    let keystoreBuffer;
    try {
      keystoreBuffer = Buffer.from(keystoreBase64, 'base64');
    } catch {
      fail('keystoreBase64 could not be decoded.');
    }
    if (!keystoreBuffer || keystoreBuffer.length === 0) fail('Decoded keystore file is empty.');

    fs.writeFileSync(keystorePath, keystoreBuffer, { mode: 0o600 });
    fs.chmodSync(keystorePath, 0o600);

    const credentialsJson = {
      android: {
        keystore: {
          keystorePath,
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

    process.stdout.write(`Wrote Android signing files to ${outDir}\n`);
    process.stdout.write(`Summary written to ${summaryPath}\n`);
  } catch (err) {
    fail(`Unexpected error while writing Android signing files: ${err instanceof Error ? err.message : String(err)}`);
  }
})();
