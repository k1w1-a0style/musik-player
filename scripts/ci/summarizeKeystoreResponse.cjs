#!/usr/bin/env node
'use strict';

const fs = require('fs');

const rawPath = process.argv[2];
const summaryPath = process.argv[3];
const httpStatus = String(process.argv[4] || '000');
if (!rawPath || !summaryPath || !/^\d{3}$/.test(httpStatus)) {
  console.error('Usage: summarizeKeystoreResponse.cjs <raw-path> <summary-path> <http-status>');
  process.exit(2);
}

const raw = fs.existsSync(rawPath) ? fs.readFileSync(rawPath) : Buffer.alloc(0);
const text = raw.toString('utf8');
const first = text.trimStart().slice(0, 1).toLowerCase();
let contentClass = 'text';
if (first === '<') contentClass = 'html';
else if (first === '{' || first === '[') contentClass = 'json-candidate';

let data;
let jsonValid = false;
try {
  data = JSON.parse(text);
  jsonValid = true;
  contentClass = 'json';
} catch {}

const isObject = jsonValid && data !== null && !Array.isArray(data) && typeof data === 'object';
const has = (key) => isObject && typeof data[key] === 'string' && data[key].length > 0;
const expectedStructure = isObject && data.ok === true && has('keystoreBase64') &&
  has('keystorePassword') && has('alias') && has('keyPassword');
const allowedTopLevelKeys = new Set(['ok', 'error', 'code']);
const safeTopLevelKeys = isObject
  ? Object.keys(data).filter((key) => allowedTopLevelKeys.has(key)).sort()
  : [];
let errorClass = 'none';
if (httpStatus !== '200') errorClass = 'http_error';
else if (!jsonValid) errorClass = 'invalid_json';
else if (!expectedStructure) errorClass = 'missing_expected_structure';

const summary = {
  httpStatus,
  responseBytes: raw.length,
  jsonValid,
  contentClass,
  errorClass,
  expectedStructure,
  hasKeystoreBase64: has('keystoreBase64'),
  hasKeystorePassword: has('keystorePassword'),
  hasAlias: has('alias'),
  hasKeyPassword: has('keyPassword'),
  safeTopLevelKeys,
};
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
if (errorClass !== 'none') {
  console.error(`Keystore export diagnostics: ${errorClass} (HTTP ${httpStatus}, ${raw.length} bytes).`);
  process.exit(1);
}
