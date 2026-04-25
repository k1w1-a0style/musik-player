const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

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
