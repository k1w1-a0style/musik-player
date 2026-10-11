import { useCallback } from 'react';
import TrackPlayer, { State } from 'react-native-track-player';
import { usePlaybackResume } from '../contexts/PlaybackResumeContext';
import type { MusicProviderRuntime } from '../contexts/useMusicProviderRuntime';
import type { MusicProviderDomainActions } from '../contexts/useMusicProviderDomainActions';
import { captureRequiredNativeHydration } from '../utils/nativeQueueMutationLock';
import { getNativeHydrationGate } from '../utils/nativeHydrationGate';
import { getNativePlaybackIntent } from '../utils/nativePlaybackIntent';

export const useResumePlayPause = (runtime: MusicProviderRuntime, actions: MusicProviderDomainActions): (() => Promise<void>) => {
  const { enabled } = usePlaybackResume();
  const toggle = useCallback(async () => {
    const song = runtime.state.currentSong;
    if (!enabled || !song || runtime.playback.isPlaying) return runtime.playback.togglePlayPause();
    const gate = captureRequiredNativeHydration(); const intent = getNativePlaybackIntent().revision;
    if (!gate) return;
    const state = await TrackPlayer.getPlaybackState();
    const ready = await TrackPlayer.getPlayWhenReady();
    const latestGate = getNativeHydrationGate();
    if (gate.generation !== latestGate.generation || gate.revision !== latestGate.revision
      || intent !== getNativePlaybackIntent().revision) return;
    if (state.state === State.Playing || ready) return runtime.playback.togglePlayPause();
    const result = await actions.playSong(song, runtime.refs.queueContextRef.current);
    if (result.status === 'failed') throw result.error ?? new Error('Wiedergabe konnte nicht gestartet werden.');
  }, [actions, enabled, runtime]);
  return enabled ? toggle : runtime.playback.togglePlayPause;
};
