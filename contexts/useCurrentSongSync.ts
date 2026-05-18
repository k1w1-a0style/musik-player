import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer, { Event } from 'react-native-track-player';
import type { Song } from '../types/Song';
import { syncCurrentSongFromActiveTrackEvent } from './currentSongSyncHelpers';
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
      syncCurrentSongFromActiveTrackEvent({
        event,
        songSources: [songsRef.current, queueContextRef.current, baseQueueContextRef.current],
        setCurrentSong,
        persistCurrentSongId,
      });
    });
    return () => sub.remove();
  }, [baseQueueContextRef, persistCurrentSongId, queueContextRef, setCurrentSong, songsRef]);
};
