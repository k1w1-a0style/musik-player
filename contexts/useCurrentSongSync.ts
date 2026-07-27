import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer, { Event } from 'react-native-track-player';
import type { Song } from '../types/Song';
import { syncCurrentSongFromActiveTrackEvent } from './currentSongSyncHelpers';
import { getNativeHydrationGate, isNativeHydrationReady } from '../utils/nativeHydrationGate';
export { findTrackSongById } from './currentSongSyncHelpers';

interface CurrentSongSyncArgs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  persistCurrentSongId: (song: Song | null) => Promise<void>;
}

export const useCurrentSongSync = ({
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  setCurrentSong,
  persistCurrentSongId,
}: CurrentSongSyncArgs): void => {
  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, event => {
      const gate = getNativeHydrationGate();
      if (!isNativeHydrationReady()) {
        console.warn('[CurrentSongSync] Ignoring active-track event while hydration is not ready.', { gateStatus: gate.status });
        return;
      }
      syncCurrentSongFromActiveTrackEvent({
        event,
        songSources: [songsRef.current, queueContextRef.current, baseQueueContextRef.current],
        setCurrentSong,
        persistCurrentSongId: async song => {
          const current = getNativeHydrationGate();
          if (current.status !== 'ready' || current.revision !== gate.revision) return;
          await persistCurrentSongId(song);
        },
      });
    });
    return () => sub.remove();
  }, [baseQueueContextRef, persistCurrentSongId, queueContextRef, setCurrentSong, songsRef]);
};
