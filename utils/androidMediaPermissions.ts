export type AndroidMediaPermissionStrategy = {
  readPermission: 'android.permission.READ_MEDIA_AUDIO' | 'android.permission.READ_EXTERNAL_STORAGE';
  writePermission?: 'android.permission.WRITE_EXTERNAL_STORAGE';
  usesScopedMediaPermissions: boolean;
  notes: string[];
};

export const getAndroidMediaPermissionStrategy = (
  apiLevel: number,
): AndroidMediaPermissionStrategy => {
  if (apiLevel >= 33) {
    return {
      readPermission: 'android.permission.READ_MEDIA_AUDIO',
      usesScopedMediaPermissions: true,
      notes: [
        'Android 13+ reads imported audio through READ_MEDIA_AUDIO.',
        'WRITE_EXTERNAL_STORAGE is ignored for Android 11+ and is not requested for tag writes.',
      ],
    };
  }

  return {
    readPermission: 'android.permission.READ_EXTERNAL_STORAGE',
    writePermission: apiLevel <= 28 ? 'android.permission.WRITE_EXTERNAL_STORAGE' : undefined,
    usesScopedMediaPermissions: false,
    notes: [
      'Android 12 and older media-library scans use READ_EXTERNAL_STORAGE when the platform requires it.',
      'Existing file tag writes are limited to app-writable file:// URIs; SAF/content:// writes stay blocked until a dedicated SAF writer exists.',
    ],
  };
};
