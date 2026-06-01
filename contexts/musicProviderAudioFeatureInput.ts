import type { MusicContextValue } from './musicContextTypes';
import type { MusicProviderAudioFeatures } from './useMusicProviderAudioFeatures';

type ContextAudioFeatureInput = Pick<
  MusicContextValue,
  'eqNative' | 'palette'
>;

export const buildMusicProviderContextAudioFeatureInput = ({
  eqNative,
  palette,
}: MusicProviderAudioFeatures): ContextAudioFeatureInput => ({
  eqNative,
  palette,
});
