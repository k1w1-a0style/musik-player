import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, InteractionManager } from 'react-native';
import type { Song } from '../types/Song';
import { useMetadataRefreshActive } from '../utils/metadataRefreshActivity';
import { setCachedWaveform, MAX_PERSISTED_WAVEFORMS } from '../utils/waveformCache';
import { getCachedWaveformForSong } from '../utils/waveformSourceCache';
import { extractNativeWaveform, resolveWaveformUri } from '../utils/waveformExtraction';
import { getWaveformCanonicalIdentity, getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS } from '../utils/waveformPreload';

const IDLE_PRELOAD_DELAY_MS = 1500;

const useAppActive = (): boolean => {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  return active;
};

/** Prepare recent imports while idle, one decoder at a time; playback wins. */
export const useLibraryWaveformPreload = (songs: Song[], enabled: boolean): void => {
  const attempted = useRef(new Set<string>());
  const songsRef = useRef(songs);
  songsRef.current = songs;
  const wakeRef = useRef<(() => void) | null>(null);
  const sourceSignature = useMemo(() => JSON.stringify(songs
    .map(getWaveformCanonicalIdentity).sort()), [songs]);
  const appActive = useAppActive();
  const metadataBusy = useMetadataRefreshActive();
  useEffect(() => {
    if (!enabled || !appActive || metadataBusy) return;
    const controller = new AbortController();
    const { signal } = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let wakeRequested = false;
    const prepare = async (): Promise<void> => {
      if (signal.aborted) return;
      // Warming more than fits on disk would evict the very files just prepared.
      const candidates = songsRef.current.slice().sort((a, b) =>
        (b.fileInfo?.importedAt ?? 0) - (a.fileInfo?.importedAt ?? 0)).slice(0, MAX_PERSISTED_WAVEFORMS);
      const keys = new Set(candidates.map(song => getWaveformSourceIdentity(song).sourceFingerprint));
      attempted.current = new Set([...attempted.current].filter(key => keys.has(key)));
      for (const song of candidates) {
        if (signal.aborted) break;
        const identity = getWaveformSourceIdentity(song);
        const duration = song.duration ?? song.audioInfo?.durationMs ?? 0;
        if (attempted.current.has(identity.sourceFingerprint) || !resolveWaveformUri(song)
          || duration <= 0 || duration > MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS) continue;
        const cached = await getCachedWaveformForSong(song).catch(() => null);
        if (signal.aborted) break;
        if (cached?.source === 'native') { attempted.current.add(identity.sourceFingerprint); continue; }
        let deferred = false;
        const waveform = await extractNativeWaveform(song, duration, {
          priority: 'background', signal,
          onDecision: result => {
            deferred = result.decision === 'native-scheduler-unavailable'
              || result.decision === 'native-scheduler-preempted';
          },
        });
        if (signal.aborted) break;
        if (deferred) {
          // Resume later when higher-priority work occupies the scheduler.
          wakeRequested = true;
          return;
        }
        attempted.current.add(identity.sourceFingerprint);
        if (waveform) await setCachedWaveform(waveform).catch(() => undefined);
      }
    };
    const run = async (): Promise<void> => {
      running = true;
      try { await prepare(); }
      finally {
        running = false;
        if (wakeRequested) { wakeRequested = false; schedule(); }
      }
    };
    const schedule = (): void => {
      if (signal.aborted) return;
      if (running) { wakeRequested = true; return; }
      if (timer !== undefined) return;
      timer = setTimeout(() => { timer = undefined; void run(); }, IDLE_PRELOAD_DELAY_MS);
    };
    const task = InteractionManager.runAfterInteractions(() => {
      wakeRef.current = schedule;
      schedule();
    });
    return () => {
      controller.abort(); task.cancel(); if (timer !== undefined) clearTimeout(timer);
      if (wakeRef.current === schedule) wakeRef.current = null;
    };
  }, [appActive, enabled, metadataBusy, sourceSignature]);
  // Metadata can make an unknown-duration source eligible. Queue one follow-up
  // pass during decoding, without cancelling the decoder.
  useEffect(() => { wakeRef.current?.(); }, [songs]);
};
