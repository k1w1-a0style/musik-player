import makeConfig from '../app.config.js';

describe('app.config development profile', () => {
  const oldProfile = process.env.EAS_BUILD_PROFILE;

  afterEach(() => {
    if (oldProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
    else process.env.EAS_BUILD_PROFILE = oldProfile;
  });

  it('uses the dedicated installable development app identity', () => {
    process.env.EAS_BUILD_PROFILE = 'development';
    const config = makeConfig({
      config: {
        name: 'Kiwi',
        android: { package: 'com.k1w1a0style.musikplayer' },
        extra: {},
      },
    });

    expect(config.name).toBe('Kiwi Dev');
    expect(config.android.package).toBe('com.k1w1a0style.musikplayer.dev');
    expect(config.runtimeVersion?.policy).not.toBe('fingerprint');
  });

  it('keeps preview/production app identity unchanged', () => {
    process.env.EAS_BUILD_PROFILE = 'preview';
    const config = makeConfig({
      config: {
        name: 'Kiwi',
        android: { package: 'com.k1w1a0style.musikplayer' },
        extra: {},
      },
    });

    expect(config.name).toBe('Kiwi');
    expect(config.android.package).toBe('com.k1w1a0style.musikplayer');
    expect(config.runtimeVersion?.policy).not.toBe('fingerprint');
  });
});
