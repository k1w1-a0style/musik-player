/**
 * Jest config — uses jest-expo preset for proper RN/Expo transform.
 * Tests live alongside their target files in __tests__/ folders or *.test.ts(x).
 */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-clone-referenced-element|@unimodules/.*|sentry-expo|native-base|react-native-svg|lucide-react-native|expo-modules-core|expo-blur|expo-linear-gradient|react-native-track-player)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^react-native-track-player$': '<rootDir>/__mocks__/react-native-track-player.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/async-storage.js',
    '^expo-system-audio$': '<rootDir>/__mocks__/expo-system-audio.js',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)+(test).ts?(x)'],
  collectCoverageFrom: [
    'utils/**/*.ts',
    'contexts/**/*.tsx',
  ],
};
