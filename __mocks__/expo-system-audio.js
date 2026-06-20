/**
 * Jest mock for the local Expo module `expo-system-audio`.
 * Returns a minimal in-memory stub so MusicContext flows can be tested
 * without a native runtime.
 */

const SystemAudio = {
  isAvailable: false,
  eqInit: jest.fn().mockResolvedValue(null),
  eqSetEnabled: jest.fn().mockReturnValue(false),
  eqSetBandLevel: jest.fn().mockReturnValue(false),
  eqRelease: jest.fn(),
  extractPalette: jest.fn(() => new Promise(() => {})),
  extractEmbeddedArtwork: jest.fn().mockResolvedValue(null),
  extractAudioInfo: jest.fn().mockResolvedValue(null),
  readAudioFileBase64: jest.fn().mockResolvedValue(null),
  writeAudioTags: jest.fn(async (uri, request = {}) => ({
    success: false,
    uri,
    changedFields: [],
    failedFields: request.changedFields || [],
    errorCode: 'WriteNotImplemented',
    message: 'Native audio tag writer is unavailable. A new development build is required.',
    verified: false,
  })),
};

module.exports = {
  __esModule: true,
  default: SystemAudio,
  SystemAudio,
};
