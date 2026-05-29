import type { MusicContextValue } from './musicContextTypes';
import type { MusicProviderAudioFeatures } from './useMusicProviderAudioFeatures';

type ContextAudioFeatureInput = Pick<
  MusicContextValue,
  'eqNative' | 'fftBins' | 'visualizerRunning' | 'visualizerError' | 'palette'
>;

export const buildMusicProviderContextAudioFeatureInput = ({
  eqNative,
  fftBins,
  visualizerRunning,
  visualizerError,
  palette,
}: MusicProviderAudioFeatures): ContextAudioFeatureInput => ({
  eqNative,
  fftBins,
  visualizerRunning,
  visualizerError,
  palette,
});
