/**
 * Global test setup — silences known native warnings and stubs reanimated.
 */
// Expo 57 installs fetch as a lazy global. Resolve it while the preset's native
// mocks are alive; Jest's teardown otherwise reads the getter after disposing
// those mocks, emits a late native-logger warning and fails an otherwise green run.
void globalThis.fetch;

// Silence noisy console.error from libraries that we cannot suppress at source
const origError = console.error;
console.error = (...args) => {
  const msg = String(args[0] ?? '');
  if (msg.includes('useNativeDriver') || msg.includes('Animated:')) return;
  origError(...args);
};
