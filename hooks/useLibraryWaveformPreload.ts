import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, InteractionManager } from 'react-native';
import type { Song } from '../types/Song';
import { useMetadataRefreshActive } from '../utils/metadataRefreshActivity';
import { setCachedWaveform } from '../utils/waveformCache';
import { MAX_WAVEFORM_CONTENTION_RETRIES, waitForWaveformSchedulerAvailability,
  WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS } from '../utils/waveformExtractionLifecycle';
import { getCachedWaveformForSong } from '../utils/waveformSourceCache';
import { extractNativeWaveform } from '../utils/waveformExtraction';
import { MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS } from '../utils/waveformPreload';
import { LibraryWaveformPreloadIndex } from '../utils/libraryWaveformPreloadIndex';

const IDLE_PRELOAD_DELAY_MS = 1500;

const useAppActive = (): boolean => {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  return active;
};

interface IdleContention { attempts: number; deadline: number }
const waitForIdleRetry = async (fingerprint: string, contention: Map<string, IdleContention>, signal: AbortSignal): Promise<boolean> => {
  const retry = contention.get(fingerprint) ?? { attempts: 0, deadline: Date.now() + WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS };
  retry.attempts += 1; contention.set(fingerprint, retry);
  if (retry.attempts >= MAX_WAVEFORM_CONTENTION_RETRIES || Date.now() >= retry.deadline) return false;
  try { await waitForWaveformSchedulerAvailability(signal, 'background', retry.deadline - Date.now()); return !signal.aborted; }
  catch { return false; }
};
const prepareIdleWaveforms = async (
  index: LibraryWaveformPreloadIndex, contention: Map<string, IdleContention>, signal: AbortSignal,
): Promise<boolean> => {
  for (const candidate of index.getCandidates()) {
    if (signal.aborted) break;
    const fingerprint = candidate.sourceFingerprint;
    if (!index.isPending(fingerprint)) continue;
    const cached = await getCachedWaveformForSong(candidate.song).catch(() => null);
    if (signal.aborted) break;
    if (!index.isPending(fingerprint)) continue;
    if (cached?.source === 'native') { index.markAttempted(fingerprint); continue; }
    let deferred = false;
    const waveform = await extractNativeWaveform(candidate.song, candidate.durationMs, {
      priority: 'background', signal,
      onDecision: result => { deferred = result.decision === 'native-scheduler-unavailable'
        || result.decision === 'native-scheduler-preempted'; },
    });
    if (signal.aborted) break;
    if (deferred && await waitForIdleRetry(fingerprint, contention, signal)) return true;
    index.markAttempted(fingerprint); contention.delete(fingerprint);
    if (waveform) await setCachedWaveform(waveform).catch(() => undefined);
  }
  return false;
};

/** Prepare recent imports while idle, one decoder at a time; playback wins. */
export const useLibraryWaveformPreload = (songs: Song[], enabled: boolean): void => {
  const preparationIndex = useRef<LibraryWaveformPreloadIndex | null>(null);
  if (!preparationIndex.current) preparationIndex.current = new LibraryWaveformPreloadIndex(MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS);
  const index = preparationIndex.current;
  const wakeRef = useRef<(() => void) | null>(null);
  const appActive = useAppActive();
  const metadataBusy = useMetadataRefreshActive();
  const canPrepare = enabled && appActive && !metadataBusy;
  const sourceRevision = useMemo(() => canPrepare ? index.update(songs) : null, [canPrepare, index, songs]);
  useEffect(() => {
    if (!canPrepare) return;
    const controller = new AbortController();
    const { signal } = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let wakeRequested = false;
    const contention = new Map<string, IdleContention>();
    const run = async (): Promise<void> => {
      running = true;
      try { wakeRequested = await prepareIdleWaveforms(index, contention, signal) || wakeRequested; }
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
  }, [canPrepare, index, sourceRevision]);
  // Metadata can make an unknown-duration source eligible. Queue one follow-up
  // pass during decoding, without cancelling the decoder.
  useEffect(() => { wakeRef.current?.(); }, [songs]);
};
