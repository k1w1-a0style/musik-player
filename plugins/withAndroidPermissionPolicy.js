/* eslint-disable @typescript-eslint/no-require-imports -- Expo config plugins are loaded as CommonJS. */
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withFinalizedMod,
} = require('expo/config-plugins');
const {
  removeForbiddenPermissions,
} = require('../modules/expo-system-audio/app.plugin.js');

/**
 * Runs after third-party config plugins so the generated application manifest
 * is the final authority: legacy reads are SDK-capped and legacy writes are
 * removed even when a dependency added them earlier in prebuild.
 */
module.exports = config => {
  const withIntrospectablePolicy = withAndroidManifest(config, nextConfig => {
    nextConfig.modResults = removeForbiddenPermissions(nextConfig.modResults);
    return nextConfig;
  });

  return withFinalizedMod(withIntrospectablePolicy, ['android', async nextConfig => {
    const manifestPath = path.join(
      nextConfig.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'AndroidManifest.xml',
    );
    const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    await AndroidConfig.Manifest.writeAndroidManifestAsync(
      manifestPath,
      removeForbiddenPermissions(manifest),
    );
    return nextConfig;
  }]);
};
