const { createRunOncePlugin } = require('expo/config-plugins');

function withExpoSystemAudio(config) {
  return config;
}

module.exports = createRunOncePlugin(
  withExpoSystemAudio,
  'expo-system-audio',
  '1.0.0',
);
