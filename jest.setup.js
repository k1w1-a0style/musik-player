/**
 * Global test setup — silences known native warnings and stubs reanimated.
 */
// Silence noisy console.error from libraries that we cannot suppress at source
const origError = console.error;
console.error = (...args) => {
  const msg = String(args[0] ?? '');
  if (msg.includes('useNativeDriver') || msg.includes('Animated:')) return;
  origError(...args);
};


// RNTP is patched in production to expose the active ExoPlayer audio session.
// Tests default to a stable valid session; focused tests can override it.
const { NativeModules } = require('react-native');
NativeModules.TrackPlayerModule = NativeModules.TrackPlayerModule || {};
NativeModules.TrackPlayerModule.getAudioSessionId = jest.fn().mockResolvedValue(17);
