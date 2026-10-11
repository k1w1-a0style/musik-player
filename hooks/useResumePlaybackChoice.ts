import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import TrackPlayer, { Event } from 'react-native-track-player';
import { usePlaybackResume } from '../contexts/PlaybackResumeContext';
import { subscribeProgressMutation } from '../modules/playback-backend/progressMutations';
import type { Song } from '../types/Song';
import { getNativeHydrationGate } from '../utils/nativeHydrationGate';
import { getNativePlaybackIntent } from '../utils/nativePlaybackIntent';
import { getResumeSource } from '../utils/resumePosition';
import { resolveResumePlaybackChoice, type ResumePlaybackChoice } from '../utils/resumePlaybackChoice';

export const useResumePlaybackChoice = (songsRef: MutableRefObject<Song[]>) => {
  const preference = usePlaybackResume();
  const live = useRef(preference); live.current = preference;
  const mounted = useRef(false); const revision = useRef({ value: 0 });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!preference.enabled) return;
    const counter = revision.current;
    const subscription = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => { counter.value++; });
    const seek = subscribeProgressMutation(() => { counter.value++; });
    return () => { counter.value++; subscription.remove(); seek(); };
  }, [preference.enabled]);
  return useCallback((song: Song): Promise<ResumePlaybackChoice> | undefined => {
    const { enabled, store } = live.current;
    if (!enabled || !store || !getResumeSource(song)) return undefined;
    const gate = getNativeHydrationGate(); const intent = getNativePlaybackIntent().revision;
    const request = revision.current.value; const source = getResumeSource(song);
    const inLibrary = songsRef.current.some(item => item.id === song.id);
    const isCurrent = (): boolean => {
      const currentGate = getNativeHydrationGate();
      const matches = songsRef.current.filter(item => item.id === song.id);
      return mounted.current && live.current.enabled && request === revision.current.value
        && intent === getNativePlaybackIntent().revision
        && gate.owned && currentGate.owned && currentGate.status === 'ready'
        && gate.generation === currentGate.generation && gate.revision === currentGate.revision
        && (!inLibrary || (matches.length === 1 && getResumeSource(matches[0]) === source));
    };
    return resolveResumePlaybackChoice(song, store, isCurrent).then(choice => ({ ...choice, isCurrent }));
  }, [songsRef]);
};
