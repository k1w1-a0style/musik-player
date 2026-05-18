import type { MusicProviderEffectsArgs } from './useMusicProviderEffects';
import type { MusicPlaybackRefs } from './useMusicPlaybackRefs';

type EffectsRefsInput = Pick<
  MusicProviderEffectsArgs,
  | 'songsRef'
  | 'queueContextRef'
  | 'baseQueueContextRef'
  | 'nativeQueueRef'
  | 'persistCurrentSongId'
>;

export const buildMusicProviderEffectsRefsInput = ({
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  persistCurrentSongId,
}: MusicPlaybackRefs): EffectsRefsInput => ({
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  nativeQueueRef,
  persistCurrentSongId,
});
