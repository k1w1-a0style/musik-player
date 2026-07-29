import makeConfig from '../app.config.js';

const SYSTEM_ALERT_WINDOW = 'android.permission.SYSTEM_ALERT_WINDOW';
const baseExpoConfig = {
  name: 'k1w1-Musik',
  android: {
    package: 'com.k1w1a0style.musikplayer',
    blockedPermissions: ['android.permission.CAMERA'],
  },
  extra: {},
};

describe('app.config EAS profile identity', () => {
  const oldProfile = process.env.EAS_BUILD_PROFILE;

  afterEach(() => {
    if (oldProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
    else process.env.EAS_BUILD_PROFILE = oldProfile;
  });

  it('keeps the visible development app label and uses the dedicated package', () => {
    process.env.EAS_BUILD_PROFILE = 'development';
    const config = makeConfig({ config: baseExpoConfig });

    expect(config.name).toBe('k1w1-Musik');
    expect(config.android.package).toBe('com.k1w1a0style.musikplayer.dev');
    expect(config.android.blockedPermissions).toContain('android.permission.CAMERA');
    expect(config.android.blockedPermissions).not.toContain(SYSTEM_ALERT_WINDOW);
    expect(config.runtimeVersion?.policy).not.toBe('fingerprint');
  });

  it('keeps preview identity and blocks development-only overlay permission', () => {
    process.env.EAS_BUILD_PROFILE = 'preview';
    const config = makeConfig({ config: baseExpoConfig });

    expect(config.name).toBe('k1w1-Musik');
    expect(config.android.package).toBe('com.k1w1a0style.musikplayer');
    expect(config.android.blockedPermissions).toEqual(
      expect.arrayContaining(['android.permission.CAMERA', SYSTEM_ALERT_WINDOW]),
    );
    expect(config.runtimeVersion?.policy).not.toBe('fingerprint');
  });

  it('keeps production identity and blocks development-only overlay permission', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    const config = makeConfig({ config: baseExpoConfig });

    expect(config.name).toBe('k1w1-Musik');
    expect(config.android.package).toBe('com.k1w1a0style.musikplayer');
    expect(config.android.blockedPermissions).toEqual(
      expect.arrayContaining(['android.permission.CAMERA', SYSTEM_ALERT_WINDOW]),
    );
    expect(config.runtimeVersion?.policy).not.toBe('fingerprint');
  });
});
