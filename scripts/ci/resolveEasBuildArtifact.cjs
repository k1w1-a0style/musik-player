#!/usr/bin/env node
'use strict';

const fs = require('fs');

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const BUILD_URL = new RegExp(`https://expo\\.dev/[^\\s]*/builds/(${UUID})(?=$|[^0-9a-fA-F-])`, 'g');

function extractBuildId(output) {
  const ids = [...String(output).matchAll(BUILD_URL)].map(match => match[1].toLowerCase());
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== 1) {
    throw new Error(`Expected exactly one EAS build-detail ID, found ${uniqueIds.length}.`);
  }
  return uniqueIds[0];
}

function normalized(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function redactUrls(output) {
  return String(output).replace(/https:\/\/[^\s]+/g, '[redacted-url]');
}

function validateBuildRecord(raw, expected) {
  let build;
  try {
    build = JSON.parse(raw);
  } catch {
    throw new Error('EAS build:view did not return valid JSON.');
  }
  if (!build || Array.isArray(build) || typeof build !== 'object') {
    throw new Error('EAS build:view must return one structured build object.');
  }
  if (normalized(build.id) !== normalized(expected.id)) {
    throw new Error('Structured EAS build ID does not match the requested build ID.');
  }
  if (normalized(build.platform) !== 'android') {
    throw new Error('Structured EAS build platform is not Android.');
  }
  if (normalized(build.status) !== 'finished') {
    throw new Error('Structured EAS build is not successfully finished.');
  }
  if (build.buildProfile != null && normalized(build.buildProfile) !== normalized(expected.profile)) {
    throw new Error('Structured EAS build profile does not match the requested profile.');
  }
  if (build.environment != null && normalized(build.environment) !== normalized(expected.environment)) {
    throw new Error('Structured EAS build environment does not match the requested environment.');
  }
  if (build.distribution != null && normalized(build.distribution) !== normalized(expected.distribution)) {
    throw new Error('Structured EAS build distribution does not match the requested distribution.');
  }
  const url = build.artifacts?.applicationArchiveUrl;
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('Structured EAS build has no application archive URL.');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Structured EAS application archive URL is invalid.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Structured EAS application archive URL is not HTTPS.');
  }
  return { artifactUrl: url, hostname: parsed.hostname, urlLength: url.length };
}

function main() {
  const [mode, ...args] = process.argv.slice(2);
  const input = fs.readFileSync(0, 'utf8');
  if (mode === 'extract-build-id') {
    process.stdout.write(extractBuildId(input));
    return;
  }
  if (mode === 'artifact-url') {
    const [id, profile, environment, distribution] = args;
    if (![id, profile, environment, distribution].every(Boolean)) {
      throw new Error('artifact-url requires expected ID, profile, environment, and distribution.');
    }
    process.stdout.write(validateBuildRecord(input, { id, profile, environment, distribution }).artifactUrl);
    return;
  }
  if (mode === 'redact-urls') {
    process.stdout.write(redactUrls(input));
    return;
  }
  throw new Error('Usage: resolveEasBuildArtifact.cjs <extract-build-id|artifact-url> [...expected values]');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`EAS artifact resolution failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { extractBuildId, redactUrls, validateBuildRecord };
