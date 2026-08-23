/* eslint-disable @typescript-eslint/no-require-imports */
const {
  FORBIDDEN_MEDIA_PERMISSIONS,
  removeForbiddenPermissions,
} = require('../modules/expo-system-audio/app.plugin.js');
const appJson = require('../app.json');

describe('expo-system-audio Android manifest plugin', () => {
  it('runs the final application permission policy after third-party plugins', () => {
    expect(appJson.expo.plugins.at(-1)).toBe('./plugins/withAndroidPermissionPolicy.js');
  });
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
          { $: { 'android:name': 'android.permission.READ_EXTERNAL_STORAGE' } },
          { $: { 'android:name': 'android.permission.WRITE_EXTERNAL_STORAGE' } },
        ],
        'uses-permission-sdk-23': [
          { $: { 'android:name': 'android.permission.READ_MEDIA_VIDEO' } },
          { $: { 'android:name': 'android.permission.MODIFY_AUDIO_SETTINGS' } },
        ],
        application: [{
          $: {
            'android:name': '.MainApplication',
            'android:requestLegacyExternalStorage': 'true',
          },
        }],
      },
    };

    const result = removeForbiddenPermissions(manifest);

    expect(result.manifest['uses-permission']).toEqual([
      {
        $: {
          'android:name': 'android.permission.RECORD_AUDIO',
          'tools:node': 'remove',
        },
      },
      { $: { 'android:name': 'android.permission.READ_MEDIA_AUDIO' } },
      {
        $: {
          'android:name': 'android.permission.READ_MEDIA_IMAGES',
          'tools:node': 'remove',
        },
      },
      {
        $: {
          'android:name': 'android.permission.READ_EXTERNAL_STORAGE',
          'android:maxSdkVersion': '32',
        },
      },
      {
        $: {
          'android:name': 'android.permission.WRITE_EXTERNAL_STORAGE',
          'tools:node': 'remove',
        },
      },
    ]);
    expect(result.manifest['uses-permission-sdk-23']).toEqual([
      {
        $: {
          'android:name': 'android.permission.READ_MEDIA_VIDEO',
          'tools:node': 'remove',
        },
      },
      { $: { 'android:name': 'android.permission.MODIFY_AUDIO_SETTINGS' } },
    ]);
    expect(result.manifest.application[0].$).toEqual({
      'android:name': '.MainApplication',
    });
  });
});
