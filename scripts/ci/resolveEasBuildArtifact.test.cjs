'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractBuildId, redactUrls, validateBuildRecord } = require('./resolveEasBuildArtifact.cjs');

const BUILD_ID = '11111111-2222-4333-8444-555555555555';
const FOREIGN_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const SECRET_URL = 'https://artifacts.example.test/archive?token=TOKEN_CANARY';

const record = (overrides = {}) => ({
  id: BUILD_ID,
  platform: 'ANDROID',
  status: 'FINISHED',
  buildProfile: 'development',
  environment: 'development',
  distribution: 'INTERNAL',
  artifacts: { applicationArchiveUrl: SECRET_URL },
  ...overrides,
});

test('extracts only the ID bound to the build-detail URL and ignores earlier UUIDs', () => {
  const output = `request ${FOREIGN_ID}\nBuild details: https://expo.dev/accounts/a/projects/p/builds/${BUILD_ID}`;
  assert.equal(extractBuildId(output), BUILD_ID);
});

for (const profile of ['development', 'preview']) {
  test(`resolves ${profile} internal artifact from structured JSON without a text artifact URL`, () => {
    const result = validateBuildRecord(JSON.stringify(record({
      buildProfile: profile,
      environment: profile,
    })), { id: BUILD_ID, profile, environment: profile, distribution: 'internal' });
    assert.equal(result.artifactUrl, SECRET_URL);
  });
}

test('resolves a production store artifact from structured JSON', () => {
  const result = validateBuildRecord(JSON.stringify(record({
    buildProfile: 'production', environment: 'production', distribution: 'STORE',
  })), { id: BUILD_ID, profile: 'production', environment: 'production', distribution: 'store' });
  assert.equal(result.artifactUrl, SECRET_URL);
});

test('ignores a fake artifact URL in human output', () => {
  const output = `https://expo.dev/artifacts/eas/fake.apk\nhttps://expo.dev/a/builds/${BUILD_ID}`;
  assert.equal(extractBuildId(output), BUILD_ID);
});

for (const [name, mutate, message] of [
  ['mismatched ID', value => ({ ...value, id: FOREIGN_ID }), /ID does not match/],
  ['non-Android platform', value => ({ ...value, platform: 'IOS' }), /not Android/],
  ['unfinished status', value => ({ ...value, status: 'IN_QUEUE' }), /not successfully finished/],
  ['mismatched profile', value => ({ ...value, buildProfile: 'preview' }), /profile does not match/],
  ['mismatched environment', value => ({ ...value, environment: 'preview' }), /environment does not match/],
  ['mismatched distribution', value => ({ ...value, distribution: 'STORE' }), /distribution does not match/],
  ['missing artifacts', value => ({ ...value, artifacts: undefined }), /no application archive URL/],
  ['missing URL', value => ({ ...value, artifacts: {} }), /no application archive URL/],
  ['empty URL', value => ({ ...value, artifacts: { applicationArchiveUrl: '' } }), /no application archive URL/],
  ['non-HTTPS URL', value => ({ ...value, artifacts: { applicationArchiveUrl: 'http://example.test/app' } }), /not HTTPS/],
]) {
  test(`fails closed for ${name}`, () => {
    assert.throws(() => validateBuildRecord(JSON.stringify(mutate(record())), {
      id: BUILD_ID, profile: 'development', environment: 'development', distribution: 'internal',
    }), message);
  });
}

test('diagnostics never include a signed URL or token canary', () => {
  let error;
  try {
    validateBuildRecord(JSON.stringify(record({ status: 'ERRORED' })), {
      id: BUILD_ID, profile: 'development', environment: 'development', distribution: 'internal',
    });
  } catch (caught) {
    error = caught;
  }
  assert.ok(error);
  assert.doesNotMatch(error.message, /TOKEN_CANARY|artifacts\.example|token=/);
  const redacted = redactUrls(`download ${SECRET_URL}`);
  assert.doesNotMatch(redacted, /TOKEN_CANARY|artifacts\.example|token=/);
  assert.match(redacted, /\[redacted-url\]/);
});
