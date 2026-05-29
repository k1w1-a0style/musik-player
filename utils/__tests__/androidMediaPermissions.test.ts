import { getAndroidMediaPermissionStrategy } from '../androidMediaPermissions';

describe('getAndroidMediaPermissionStrategy', () => {
  test('Android 13+ uses READ_MEDIA_AUDIO without legacy write permission', () => {
    expect(getAndroidMediaPermissionStrategy(33)).toMatchObject({
      readPermission: 'android.permission.READ_MEDIA_AUDIO',
      usesScopedMediaPermissions: true,
    });
    expect(getAndroidMediaPermissionStrategy(35).writePermission).toBeUndefined();
  });

  test('older Android uses READ_EXTERNAL_STORAGE and only requests legacy write before scoped storage', () => {
    expect(getAndroidMediaPermissionStrategy(32)).toMatchObject({
      readPermission: 'android.permission.READ_EXTERNAL_STORAGE',
      usesScopedMediaPermissions: false,
    });
    expect(getAndroidMediaPermissionStrategy(32).writePermission).toBeUndefined();
    expect(getAndroidMediaPermissionStrategy(28).writePermission).toBe(
      'android.permission.WRITE_EXTERNAL_STORAGE',
    );
  });
});
