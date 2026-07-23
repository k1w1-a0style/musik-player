import type { MusicContextValue } from './musicContextTypes';
import type { MusicProviderAudioFeatures } from './useMusicProviderAudioFeatures';

type ContextAudioFeatureInput = Pick<
  MusicContextValue,
  'eqNative' | 'palette' | 'paletteLoading'
>;

export const buildMusicProviderContextAudioFeatureInput = ({
  eqNative,
  palette,
  paletteLoading,
}: MusicProviderAudioFeatures): ContextAudioFeatureInput => ({
  eqNative,
  palette,
  ...(paletteLoading === undefined ? {} : { paletteLoading }),
});
