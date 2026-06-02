import makeConfig from '../app.config.js';

const baseExpoConfig = {
  name: 'k1w1-Musik',
  android: { package: 'com.k1w1a0style.musikplayer' },
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
    expect(config.runtimeVersion?.policy).not.toBe('fingerprint');
  });

  it('keeps preview app label and package unchanged', () => {
    process.env.EAS_BUILD_PROFILE = 'preview';
    const config = makeConfig({ config: baseExpoConfig });

    expect(config.name).toBe('k1w1-Musik');
    expect(config.android.package).toBe('com.k1w1a0style.musikplayer');
    expect(config.runtimeVersion?.policy).not.toBe('fingerprint');
  });

  it('keeps production app label and package unchanged', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    const config = makeConfig({ config: baseExpoConfig });

    expect(config.name).toBe('k1w1-Musik');
    expect(config.android.package).toBe('com.k1w1a0style.musikplayer');
    expect(config.runtimeVersion?.policy).not.toBe('fingerprint');
  });
});
