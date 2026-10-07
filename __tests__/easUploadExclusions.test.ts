import fs from 'fs';
import path from 'path';
import ignore from 'ignore';

const root = path.resolve(__dirname, '..');
const archiveFilter = ignore().add(fs.readFileSync(path.join(root, '.easignore'), 'utf8'));

describe('EAS source archive boundary', () => {
  test.each([
    '.env', '.env.production', 'local.env', 'credentials.json', 'ci-credentials/export.json',
    'signing/upload.jks', 'android-upload-keystore.p12', 'keys/upload.keystore',
    'keys/private.pem', 'keys/signing.key', '.credentials/session.json', '.npmrc',
    'nested/.npmrc', 'diagnostics/build.log', 'coverage/coverage-final.json',
    'backup/project.backup', '.git/config', 'android/app/build/output.apk',
    'ci-logs/npm-audit-production.json', 'ci-android-export/android.hbc.map',
    'scripts/ci/__pycache__/diagnostics.cpython-313.pyc',
  ])('excludes local sensitive or generated input: %s', candidate => {
    expect(archiveFilter.ignores(candidate)).toBe(true);
  });

  test.each([
    'app.config.js', 'eas.json', 'package.json', 'package-lock.json',
    'modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/SystemAudioModule.kt',
    'scripts/patches/patchReactNativeTrackPlayer.cjs', '.env.example',
  ])('retains required source or documented placeholders: %s', candidate => {
    expect(archiveFilter.ignores(candidate)).toBe(false);
  });
});
