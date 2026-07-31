import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..');
const easConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'eas.json'), 'utf8'));

describe('EAS build profile environments', () => {
  it('pins development as an internal dev-client APK in the development environment', () => {
    expect(easConfig.build.development.environment).toBe('development');
    expect(easConfig.build.development.distribution).toBe('internal');
    expect(easConfig.build.development.android.developmentClient).toBe(true);
    expect(easConfig.build.development.android.buildType).toBe('apk');
    expect(easConfig.build.development.android.withoutCredentials).toBe(true);
  });

  it('pins preview as an internal APK in the preview environment', () => {
    expect(easConfig.build.preview.environment).toBe('preview');
    expect(easConfig.build.preview.distribution).toBe('internal');
    expect(easConfig.build.preview.android.buildType).toBe('apk');
    expect(easConfig.build.preview.android.withoutCredentials).toBe(true);
  });

  it('pins production to the production environment and Android APK output', () => {
    expect(easConfig.build.production.environment).toBe('production');
    expect(easConfig.build.production.android.buildType).toBe('apk');
  });

  it('keeps every Android build profile on the APK artifact contract', () => {
    const androidProfiles = Object.entries(easConfig.build).map(([profile, config]) => ({
      profile,
      buildType: (config as { android?: { buildType?: string } }).android?.buildType,
    }));

    expect(androidProfiles).toEqual([
      { profile: 'development', buildType: 'apk' },
      { profile: 'preview', buildType: 'apk' },
      { profile: 'production', buildType: 'apk' },
    ]);
  });
});
