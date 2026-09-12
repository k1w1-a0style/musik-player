import { useEffect, useRef, useState } from 'react';
import { AppState, InteractionManager } from 'react-native';
import type { Song } from '../types/Song';
import { useMetadataRefreshActive } from '../utils/metadataRefreshActivity';
import { getCachedWaveform, setCachedWaveform, MAX_PERSISTED_WAVEFORMS } from '../utils/waveformCache';
import { extractNativeWaveform, resolveWaveformUri } from '../utils/waveformExtraction';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS } from '../utils/waveformPreload';

/** Prepare recent imports while idle, one decoder at a time; playback wins. */
export const useLibraryWaveformPreload = (songs: Song[], enabled: boolean): void => {
  const attempted = useRef(new Set<string>());
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const metadataBusy = useMetadataRefreshActive();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!enabled || !appActive || metadataBusy) return;
    const controller = new AbortController();
    const { signal } = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        void (async () => {
          // Warming more than fits on disk would evict the very files just prepared.
          const candidates = songs.slice().sort((a, b) =>
            (b.fileInfo?.importedAt ?? 0) - (a.fileInfo?.importedAt ?? 0)).slice(0, MAX_PERSISTED_WAVEFORMS);
          const keys = new Set(candidates.map(song => getWaveformSourceIdentity(song).sourceFingerprint));
          attempted.current = new Set([...attempted.current].filter(key => keys.has(key)));
          for (const song of candidates) {
            if (signal.aborted) break;
            const identity = getWaveformSourceIdentity(song);
            const duration = song.duration ?? song.audioInfo?.durationMs ?? 0;
            if (attempted.current.has(identity.sourceFingerprint) || !resolveWaveformUri(song)
              || duration <= 0 || duration > MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS) continue;
            const cached = await getCachedWaveform(identity).catch(() => null);
            if (signal.aborted) break;
            if (cached?.source === 'native') { attempted.current.add(identity.sourceFingerprint); continue; }
            let deferred = false;
            const waveform = await extractNativeWaveform(song, duration, {
              priority: 'background', signal,
              onDecision: result => { deferred = result.decision === 'native-scheduler-unavailable'; },
            });
            if (signal.aborted) break;
            if (!deferred) attempted.current.add(identity.sourceFingerprint);
            if (waveform) await setCachedWaveform(waveform).catch(() => undefined);
          }
        })();
      }, 1500);
    });
    return () => { controller.abort(); task.cancel(); if (timer) clearTimeout(timer); };
  }, [appActive, enabled, metadataBusy, songs]);
};
