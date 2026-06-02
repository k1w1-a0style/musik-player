import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const gateScript = path.join(__dirname, '..', 'scripts', 'ci', 'checkExpoReleaseConfig.cjs');

const baseConfig = {
  name: 'k1w1-Musik',
  scheme: 'musik-player',
  slug: 'musik-player',
  android: {
    package: 'com.k1w1a0style.musikplayer',
    permissions: [
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
    ],
  },
  newArchEnabled: false,
  extra: { eas: { projectId: '00000000-0000-4000-8000-000000000000' } },
};

const runGate = (config: unknown) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-release-gate-'));
  const file = path.join(dir, 'expo-config.json');
  fs.writeFileSync(file, JSON.stringify(config), 'utf8');
  const result = spawnSync(process.execPath, [gateScript, file], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
};

describe('Expo release config gate', () => {
  it('passes a release-safe config', () => {
    const result = runGate(baseConfig);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Expo config release gate passed.');
  });

  it('fails when RECORD_AUDIO is declared as an Android permission', () => {
    const result = runGate({
      ...baseConfig,
      android: {
        ...baseConfig.android,
        permissions: [...baseConfig.android.permissions, 'android.permission.RECORD_AUDIO'],
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Forbidden Android permission declared: android.permission.RECORD_AUDIO');
  });

  it('fails when RECORD_AUDIO is not blocked', () => {
    const result = runGate({
      ...baseConfig,
      android: {
        ...baseConfig.android,
        blockedPermissions: baseConfig.android.blockedPermissions.filter(
          permission => permission !== 'android.permission.RECORD_AUDIO',
        ),
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Android blocked permission missing: android.permission.RECORD_AUDIO');
  });
});
