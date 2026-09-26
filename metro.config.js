const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { disableTypes: disableImageSizeTypes } = require('image-size');

// Metro 0.83.3 needs image-size's 1.x synchronous file API; the published
// security fixes start at 2.0.3 with a different file API. Metro only needs its
// ordinary web/mobile image handlers, so fail closed on the vulnerable parser
// families even when malicious bytes are disguised behind a .png/.jpg name.
disableImageSizeTypes(['heif', 'icns', 'jxl', 'jxl-stream']);

const config = getDefaultConfig(__dirname);

// Resolve `expo-system-audio` to the local module so Metro can bundle it
// without it being copied into node_modules (which would confuse Expo
// autolinking with a duplicate detection).
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'expo-system-audio': path.resolve(__dirname, 'modules/expo-system-audio'),
};
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, 'modules/expo-system-audio'),
];

module.exports = config;
