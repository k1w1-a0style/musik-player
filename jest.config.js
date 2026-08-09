/**
 * Jest config — uses jest-expo preset for proper RN/Expo transform.
 * Tests live alongside their target files in __tests__/ folders or *.test.ts(x).
 */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-clone-referenced-element|@unimodules/.*|sentry-expo|native-base|react-native-svg|lucide-react-native|expo-modules-core|expo-blur|expo-linear-gradient|react-native-track-player|uuid)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^react-native-track-player$': '<rootDir>/__mocks__/react-native-track-player.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/async-storage.js',
    '^expo-system-audio$': '<rootDir>/__mocks__/expo-system-audio.js',
    '^expo-image-picker$': '<rootDir>/__mocks__/expo-image-picker.js',
    '^\\.\\./utils/tagWriteVerification$':
      '<rootDir>/__mocks__/tagWriteVerificationProxy.js',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)+(test).ts?(x)'],
  collectCoverageFrom: [
    'utils/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'screens/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    '!**/__tests__/**',
    '!**/*.test.{ts,tsx}',
    '!**/*.d.ts',
    '!utils/tagWriter.ts',
    '!**/node_modules/**',
    '!**/coverage/**',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
    './utils/': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    './hooks/': {
      statements: 75,
      branches: 65,
      functions: 75,
      lines: 75,
    },
    './contexts/': {
      statements: 75,
      branches: 65,
      functions: 75,
      lines: 75,
    },
    './utils/mediaLibraryImport.ts': {
      statements: 85,
      branches: 72,
      functions: 85,
      lines: 85,
    },
    './utils/storage.ts': {
      statements: 92,
      branches: 85,
      functions: 90,
      lines: 92,
    },
    './contexts/useLibraryActions.ts': {
      statements: 85,
      branches: 75,
      functions: 85,
      lines: 85,
    },
    './utils/tagWriteOrchestrator.ts': {
      statements: 90,
      branches: 85,
      functions: 85,
      lines: 90,
    },
    './utils/waveformExtractionLifecycle.ts': {
      statements: 75,
      branches: 65,
      functions: 85,
      lines: 75,
    },
  },
};
