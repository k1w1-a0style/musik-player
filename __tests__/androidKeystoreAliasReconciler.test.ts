import fs from 'fs';
import os from 'os';
import path from 'path';

const {
  parsePrivateKeyAliases,
  reconcileAndroidKeystoreAlias,
  resolveContainedPath,
} = require('../scripts/ci/reconcileAndroidKeystoreAlias.cjs'); // eslint-disable-line @typescript-eslint/no-require-imports

const createFixture = (configuredAlias = 'stale-alias') => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'k1w1-keystore-alias-'));
  const credentialsPath = path.join(projectRoot, 'credentials.json');
  fs.writeFileSync(path.join(projectRoot, 'android-upload-keystore.p12'), Buffer.alloc(64, 1));
  fs.writeFileSync(credentialsPath, JSON.stringify({
    android: {
      keystore: {
        keystorePath: 'android-upload-keystore.p12',
        keystorePassword: 'store-secret',
        keyAlias: configuredAlias,
        keyPassword: 'key-secret',
      },
    },
  }));
  return { credentialsPath, projectRoot };
};

describe('Android keystore alias reconciler', () => {
  it('parses only PrivateKeyEntry aliases from stable English keytool output', () => {
    expect(parsePrivateKeyAliases(`Alias name: release-key\nEntry type: PrivateKeyEntry\n\nAlias name: trusted-cert\nEntry type: trustedCertEntry\n`))
      .toEqual(['release-key']);
  });

  it('keeps a configured alias that exists in the keystore', () => {
    const fixture = createFixture('release-key');
    const result = reconcileAndroidKeystoreAlias({
      ...fixture,
      inspectAliases: () => ['release-key'],
    });

    expect(result).toEqual({ changed: false, privateKeyEntryCount: 1 });
    expect(JSON.parse(fs.readFileSync(fixture.credentialsPath, 'utf8')).android.keystore.keyAlias)
      .toBe('release-key');
  });

  it('reconciles a stale alias when the keystore has exactly one private key', () => {
    const fixture = createFixture();
    const masked: string[] = [];
    const result = reconcileAndroidKeystoreAlias({
      ...fixture,
      inspectAliases: () => ['actual-release-key'],
      mask: (value: string) => masked.push(value),
    });

    expect(result).toEqual({ changed: true, privateKeyEntryCount: 1 });
    expect(masked).toEqual(['actual-release-key']);
    expect(JSON.parse(fs.readFileSync(fixture.credentialsPath, 'utf8')).android.keystore.keyAlias)
      .toBe('actual-release-key');
  });

  it.each([[[]], [['first', 'second']]])('fails closed when reconciliation is ambiguous: %j', aliases => {
    const fixture = createFixture();
    expect(() => reconcileAndroidKeystoreAlias({
      ...fixture,
      inspectAliases: () => aliases,
    })).toThrow(/reconciliation is ambiguous/);
  });

  it('rejects a keystore path outside the project root', () => {
    expect(() => resolveContainedPath('/tmp/project', '../outside.p12')).toThrow(/escapes/);
  });
});
