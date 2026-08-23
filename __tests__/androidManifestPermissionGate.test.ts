import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const gateScript = path.join(
  __dirname,
  '..',
  'scripts',
  'ci',
  'checkAndroidManifestPermissions.cjs',
);

const manifest = (permissions: string[]): string => `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
${permissions.map(permission => `  <uses-permission android:name="${permission}" />`).join('\n')}
</manifest>
`;

const runGate = (permissions: string[] | string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'android-manifest-gate-'));
  const file = path.join(dir, 'AndroidManifest.xml');
  fs.writeFileSync(file, typeof permissions === 'string' ? permissions : manifest(permissions), 'utf8');
  const result = spawnSync(process.execPath, [gateScript, file], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
};

const requiredPermissions = [
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];

describe('generated AndroidManifest permission gate', () => {
  test('ignores permissions explicitly removed by the manifest merger', () => {
    const result = runGate(`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  ${requiredPermissions.map(permission => `<uses-permission android:name="${permission}" />`).join('\n  ')}
  <uses-permission android:name="android.permission.CAMERA" tools:node="remove" />
  <uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove" />
</manifest>`);
    expect(result.status).toBe(0);
  });
  it('passes a release-safe generated manifest', () => {
    const result = runGate(requiredPermissions);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Generated AndroidManifest permission gate passed.');
  });

  it('accepts legacy read access only when capped at Android 12L', () => {
    const result = runGate(`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  ${requiredPermissions.map(permission => `<uses-permission android:name="${permission}" />`).join('\n  ')}
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
</manifest>`);

    expect(result.status).toBe(0);
  });

  it('fails when legacy read access is not capped', () => {
    const result = runGate([...requiredPermissions, 'android.permission.READ_EXTERNAL_STORAGE']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Generated AndroidManifest legacy permission android.permission.READ_EXTERNAL_STORAGE must declare android:maxSdkVersion="32"',
    );
  });

  it('fails when legacy write access is present', () => {
    const result = runGate([...requiredPermissions, 'android.permission.WRITE_EXTERNAL_STORAGE']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Generated AndroidManifest contains forbidden permission: android.permission.WRITE_EXTERNAL_STORAGE',
    );
  });

  it('fails when legacy external-storage mode is requested', () => {
    const result = runGate(`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  ${requiredPermissions.map(permission => `<uses-permission android:name="${permission}" />`).join('\n  ')}
  <application android:requestLegacyExternalStorage="true" />
</manifest>`);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Generated AndroidManifest must not declare android:requestLegacyExternalStorage',
    );
  });

  it('fails when a required playback permission is missing', () => {
    const result = runGate(
      requiredPermissions.filter(
        permission => permission !== 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      ),
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Generated AndroidManifest missing required permission: android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    );
  });

  it('fails when RECORD_AUDIO is present', () => {
    const result = runGate([...requiredPermissions, 'android.permission.RECORD_AUDIO']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Generated AndroidManifest contains forbidden permission: android.permission.RECORD_AUDIO',
    );
  });

  it('fails when an undeclared permission is present', () => {
    const result = runGate([...requiredPermissions, 'android.permission.BODY_SENSORS']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Generated AndroidManifest contains unexpected permission outside the release allowlist: android.permission.BODY_SENSORS',
    );
  });

  it('fails when visual media permissions are present', () => {
    const result = runGate([
      ...requiredPermissions,
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Generated AndroidManifest contains forbidden permission: android.permission.READ_MEDIA_IMAGES',
    );
    expect(result.stderr).toContain(
      'Generated AndroidManifest contains forbidden permission: android.permission.READ_MEDIA_VIDEO',
    );
    expect(result.stderr).toContain(
      'Generated AndroidManifest contains forbidden permission: android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
    );
  });
});
