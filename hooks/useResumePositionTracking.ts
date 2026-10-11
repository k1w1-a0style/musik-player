import { useEffect, type MutableRefObject } from 'react';
import { AppState } from 'react-native';
import TrackPlayer, { Event, State } from 'react-native-track-player';
import type { Song } from '../types/Song';
import { usePlaybackResume } from '../contexts/PlaybackResumeContext';
import { subscribeProgressMutation } from '../modules/playback-backend/progressMutations';
import { getNativeHydrationGate, isNativeHydrationReady } from '../utils/nativeHydrationGate';

const sourceSong = (queue: Song[], mediaId?: string): Song | undefined => {
  if (!mediaId) return undefined;
  let matched: Song | undefined;
  for (const song of queue) {
    if (song.id !== mediaId) continue;
    if (matched) return undefined;
    matched = song;
  }
  return matched;
};
export const useResumePositionTracking = (nativeQueueRef: MutableRefObject<Song[]>): void => {
  const { enabled, store } = usePlaybackResume();
  useEffect(() => {
    if (!enabled || !store) return;
    let active = true; let reading = false; let pending = false; let revision = 0; let observedPlayback = false;
    const flush = (): void => { void store.flush().catch(error => console.warn('[Resume] Position flush failed.', error)); };
    const snapshot = async (): Promise<void> => {
      if (!active || !isNativeHydrationReady()) return;
      if (reading) { pending = true; return; }
      reading = true; const requested = revision; const gate = getNativeHydrationGate();
      try {
        const track = await TrackPlayer.getActiveTrack();
        const progress = await TrackPlayer.getProgress();
        const verified = await TrackPlayer.getActiveTrack();
        const song = sourceSong(nativeQueueRef.current, track?.id);
        const latestGate = getNativeHydrationGate();
        if (active && requested === revision && latestGate.status === 'ready'
          && gate.generation === latestGate.generation && gate.revision === latestGate.revision
          && track?.id === verified?.id && song) {
          await store.record(song, progress.position * 1000, progress.duration * 1000);
          flush();
        }
      } catch (error) { console.warn('[Resume] Progress snapshot unavailable.', error); }
      finally {
        reading = false;
        if (active && pending) { pending = false; void snapshot(); }
      }
    };
    const heartbeat = TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, receipt => {
      const song = sourceSong(nativeQueueRef.current, receipt.mediaId);
      if (!active || !isNativeHydrationReady() || !song || !Number.isFinite(receipt.timestamp)) return;
      observedPlayback = true;
      revision += 1;
      void store.record(song, receipt.position * 1000, receipt.duration * 1000, receipt.timestamp)
        .catch(error => console.warn('[Resume] Progress receipt ignored.', error));
    });
    const track = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => { revision += 1; flush(); });
    const state = TrackPlayer.addEventListener(Event.PlaybackState, receipt => {
      if (!isNativeHydrationReady()) return;
      if (receipt.state === State.Playing) observedPlayback = true;
      if (observedPlayback && (receipt.state === State.Paused || receipt.state === State.Stopped || receipt.state === State.Ended)) void snapshot();
    });
    const background = AppState.addEventListener('change', value => { if (observedPlayback && value !== 'active') void snapshot(); });
    const unsubscribeSeek = subscribeProgressMutation(() => {
      if (!isNativeHydrationReady()) return;
      observedPlayback = true; revision += 1; void snapshot();
    });
    return () => {
      active = false; heartbeat.remove(); track.remove(); state.remove(); background.remove(); unsubscribeSeek(); flush();
    };
  }, [enabled, nativeQueueRef, store]);
};
