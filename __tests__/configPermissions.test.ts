import fs from 'fs';
import path from 'path';

describe('release permissions config', () => {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'),
  );

  it('does not declare RECORD_AUDIO in android permissions', () => {
    const permissions: string[] = appJson?.expo?.android?.permissions ?? [];
    expect(permissions).not.toContain('android.permission.RECORD_AUDIO');
  });

  it('blocks RECORD_AUDIO after Expo prebuild merges plugin permissions', () => {
    const blockedPermissions: string[] = appJson?.expo?.android?.blockedPermissions ?? [];
    expect(blockedPermissions).toContain('android.permission.RECORD_AUDIO');
  });

  it('does not declare NSMicrophoneUsageDescription in ios infoPlist', () => {
    const micUsage = appJson?.expo?.ios?.infoPlist?.NSMicrophoneUsageDescription;
    expect(micUsage).toBeUndefined();
  });
});
