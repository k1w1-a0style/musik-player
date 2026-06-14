import fs from 'fs';
import path from 'path';

describe('release permissions config', () => {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'),
  );

  const microphoneAndVisualMediaPermissions = [
    'android.permission.RECORD_AUDIO',
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  ];

  it('does not declare microphone or visual media permissions in android permissions', () => {
    const permissions: string[] = appJson?.expo?.android?.permissions ?? [];
    for (const permission of microphoneAndVisualMediaPermissions) {
      expect(permissions).not.toContain(permission);
    }
  });

  it('blocks all microphone and visual media permissions after Expo prebuild merges plugin permissions', () => {
    const blockedPermissions: string[] = appJson?.expo?.android?.blockedPermissions ?? [];

    expect(blockedPermissions).toEqual(
      expect.arrayContaining(microphoneAndVisualMediaPermissions),
    );
  });

  it('does not declare NSMicrophoneUsageDescription in ios infoPlist', () => {
    const micUsage = appJson?.expo?.ios?.infoPlist?.NSMicrophoneUsageDescription;
    expect(micUsage).toBeUndefined();
  });
});
