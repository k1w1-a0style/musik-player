#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const parsePrivateKeyAliases = output => {
  const aliases = [];
  let currentAlias = '';

  for (const line of String(output || '').split(/\r?\n/)) {
    const aliasMatch = line.match(/^Alias name:\s*(.+?)\s*$/i);
    if (aliasMatch) {
      currentAlias = aliasMatch[1];
      continue;
    }

    if (currentAlias && /^Entry type:\s*PrivateKeyEntry\s*$/i.test(line)) {
      aliases.push(currentAlias);
      currentAlias = '';
    }
  }

  return [...new Set(aliases)];
};

const resolveKeytool = env => {
  const javaHome = env.JAVA_HOME_17_X64 || env.JAVA_HOME;
  return javaHome ? path.join(javaHome, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool';
};

const inspectPrivateKeyAliases = ({ keystorePath, keystorePassword, env = process.env }) => {
  const result = spawnSync(resolveKeytool(env), [
    '-J-Duser.language=en',
    '-J-Duser.country=US',
    '-list',
    '-v',
    '-keystore',
    keystorePath,
    '-storepass',
    keystorePassword,
  ], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    env,
  });

  if (result.status !== 0) {
    throw new Error('keytool could not inspect the exported Android keystore.');
  }

  return parsePrivateKeyAliases(result.stdout);
};

const requireString = (value, label) => {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`Missing ${label} in credentials.json.`);
  return normalized;
};

const resolveContainedPath = (rootDir, relativePath) => {
  if (path.isAbsolute(relativePath)) throw new Error('Android keystore path must be relative to the project root.');
  const resolved = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Android keystore path escapes or aliases the project root.');
  }
  return resolved;
};

const reconcileAndroidKeystoreAlias = ({
  credentialsPath = path.join(process.cwd(), 'credentials.json'),
  projectRoot = process.cwd(),
  inspectAliases = inspectPrivateKeyAliases,
  mask = () => {},
} = {}) => {
  const parsed = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const keystore = parsed?.android?.keystore;
  if (!keystore || typeof keystore !== 'object') {
    throw new Error('Missing android.keystore in credentials.json.');
  }

  const keystoreRelativePath = requireString(keystore.keystorePath, 'android.keystore.keystorePath');
  const keystorePassword = requireString(keystore.keystorePassword, 'android.keystore.keystorePassword');
  const configuredAlias = requireString(keystore.keyAlias, 'android.keystore.keyAlias');
  requireString(keystore.keyPassword, 'android.keystore.keyPassword');

  const keystorePath = resolveContainedPath(projectRoot, keystoreRelativePath);
  const stat = fs.statSync(keystorePath);
  if (!stat.isFile() || stat.size < 32) throw new Error('Exported Android keystore is missing or too small.');

  const aliases = inspectAliases({ keystorePath, keystorePassword });
  for (const alias of aliases) mask(alias);

  if (aliases.includes(configuredAlias)) {
    return { changed: false, privateKeyEntryCount: aliases.length };
  }
  if (aliases.length !== 1) {
    throw new Error(`Configured Android key alias is absent and reconciliation is ambiguous (${aliases.length} private-key entries).`);
  }

  keystore.keyAlias = aliases[0];
  fs.writeFileSync(credentialsPath, JSON.stringify(parsed, null, 2), { mode: 0o600 });
  fs.chmodSync(credentialsPath, 0o600);
  return { changed: true, privateKeyEntryCount: 1 };
};

const addMask = value => {
  if (value) process.stdout.write(`::add-mask::${value}\n`);
};

if (require.main === module) {
  try {
    const result = reconcileAndroidKeystoreAlias({ mask: addMask });
    const action = result.changed ? 'reconciled to the sole private-key entry' : 'already matched';
    process.stdout.write(`Android signing alias ${action}; validated ${result.privateKeyEntryCount} private-key entry.\n`);
  } catch (error) {
    process.stderr.write(`::error::Android signing alias preflight failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

module.exports = {
  inspectPrivateKeyAliases,
  parsePrivateKeyAliases,
  reconcileAndroidKeystoreAlias,
  resolveContainedPath,
};
