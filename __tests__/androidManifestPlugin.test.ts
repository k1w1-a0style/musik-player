/* eslint-disable @typescript-eslint/no-require-imports */
const {
  FORBIDDEN_MEDIA_PERMISSIONS,
  removeForbiddenPermissions,
} = require('../modules/expo-system-audio/app.plugin.js');

describe('expo-system-audio Android manifest plugin', () => {
  it('tracks RECORD_AUDIO as a forbidden permission', () => {
    expect(FORBIDDEN_MEDIA_PERMISSIONS.has('android.permission.RECORD_AUDIO')).toBe(true);
  });

  it('removes forbidden media permissions from all manifest permission sections', () => {
    const manifest = {
      manifest: {
        'uses-permission': [
          { $: { 'android:name': 'android.permission.RECORD_AUDIO' } },
          { $: { 'android:name': 'android.permission.READ_MEDIA_AUDIO' } },
          { $: { 'android:name': 'android.permission.READ_MEDIA_IMAGES' } },
        ],
        'uses-permission-sdk-23': [
          { $: { 'android:name': 'android.permission.READ_MEDIA_VIDEO' } },
          { $: { 'android:name': 'android.permission.MODIFY_AUDIO_SETTINGS' } },
        ],
      },
    };

    const result = removeForbiddenPermissions(manifest);

    expect(result.manifest['uses-permission']).toEqual([
      { $: { 'android:name': 'android.permission.READ_MEDIA_AUDIO' } },
    ]);
    expect(result.manifest['uses-permission-sdk-23']).toEqual([
      { $: { 'android:name': 'android.permission.MODIFY_AUDIO_SETTINGS' } },
    ]);
  });
});
