import type { MusicProviderActionsArgs } from './useMusicProviderActions';
import type { MusicPlaybackRefs } from './useMusicPlaybackRefs';
import type { MusicProviderState } from './useMusicProviderState';

export const buildMusicProviderActionsInput = ({
  playbackRefs,
  providerState,
  currentSongId,
}: {
  playbackRefs: MusicPlaybackRefs;
  providerState: MusicProviderState;
  currentSongId?: string;
}): MusicProviderActionsArgs => ({
  playback: {
    songsRef: playbackRefs.songsRef,
    queueContextRef: playbackRefs.queueContextRef,
    baseQueueContextRef: playbackRefs.baseQueueContextRef,
    nativeQueueRef: playbackRefs.nativeQueueRef,
    setPlaybackQueue: providerState.setPlaybackQueue,
    setCurrentSong: providerState.setCurrentSong,
    currentSongId,
    shuffle: providerState.shuffle,
    setShuffle: providerState.setShuffle,
  },
  library: {
    queueContextRef: playbackRefs.queueContextRef,
    baseQueueContextRef: playbackRefs.baseQueueContextRef,
    nativeQueueRef: playbackRefs.nativeQueueRef,
    setSongsState: providerState.setSongsState,
    setCurrentSong: providerState.setCurrentSong,
    setPlaybackQueue: providerState.setPlaybackQueue,
    setPlaylists: providerState.setPlaylists,
  },
  playlists: {
    playlists: providerState.playlists,
    setPlaylists: providerState.setPlaylists,
    songsRef: playbackRefs.songsRef,
  },
});
