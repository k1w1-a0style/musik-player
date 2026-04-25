/**
 * Jest mock for the local Expo module `expo-system-audio`.
 * Returns a minimal in-memory stub so MusicContext flows can be tested
 * without a native runtime.
 */

let visualizerCb = null;
let stateCb = null;

const SystemAudio = {
  isAvailable: false,
  eqInit: jest.fn().mockResolvedValue(null),
  eqSetEnabled: jest.fn().mockReturnValue(false),
  eqSetBandLevel: jest.fn().mockReturnValue(false),
  eqRelease: jest.fn(),
  visualizerStart: jest.fn().mockResolvedValue(false),
  visualizerStop: jest.fn(),
  onFft: jest.fn(cb => {
    visualizerCb = cb;
    return { remove: () => { visualizerCb = null; } };
  }),
  onVisualizerState: jest.fn(cb => {
    stateCb = cb;
    return { remove: () => { stateCb = null; } };
  }),
  extractPalette: jest.fn().mockResolvedValue(null),
  __triggerFft: data => visualizerCb?.(data),
  __triggerState: e => stateCb?.(e),
};

module.exports = {
  __esModule: true,
  default: SystemAudio,
  SystemAudio,
};
