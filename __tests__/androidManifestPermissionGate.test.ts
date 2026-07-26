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

const runGate = (permissions: string[]) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'android-manifest-gate-'));
  const file = path.join(dir, 'AndroidManifest.xml');
  fs.writeFileSync(file, manifest(permissions), 'utf8');
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
  it('passes a release-safe generated manifest', () => {
    const result = runGate(requiredPermissions);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Generated AndroidManifest permission gate passed.');
  });

  it('fails when a required playback permission is missing', () => {
    const result = runGate(
      requiredPermissions.filter(
        permission => permission !== 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      ),
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Generated AndroidManifest is missing required permission: android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
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
