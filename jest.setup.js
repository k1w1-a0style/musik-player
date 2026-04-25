/**
 * Global test setup — silences known native warnings and stubs reanimated.
 */
require('react-native-reanimated/mock');

// Silence noisy console.error from libraries that we cannot suppress at source
const origError = console.error;
console.error = (...args) => {
  const msg = String(args[0] ?? '');
  if (msg.includes('useNativeDriver') || msg.includes('Animated:')) return;
  origError(...args);
};
