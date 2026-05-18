import { buildMusicProviderContextAudioFeatureInput } from '../musicProviderAudioFeatureInput';
import type { MusicProviderAudioFeatures } from '../useMusicProviderAudioFeatures';

const audioFeatures: MusicProviderAudioFeatures = {
  eqNative: null,
  fftBins: [1, 2, 3],
  visualizerRunning: true,
  visualizerError: null,
  palette: { dominant: '#111111' },
};

describe('buildMusicProviderContextAudioFeatureInput', () => {
  test('builds context audio feature input', () => {
    expect(buildMusicProviderContextAudioFeatureInput(audioFeatures)).toEqual({
      eqNative: null,
      fftBins: [1, 2, 3],
      visualizerRunning: true,
      visualizerError: null,
      palette: { dominant: '#111111' },
    });
  });
});
