import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, InteractionManager } from 'react-native';
import type { Song } from '../types/Song';
import { useMetadataRefreshActive } from '../utils/metadataRefreshActivity';
import { setCachedWaveform } from '../utils/waveformCache';
import { MAX_WAVEFORM_CONTENTION_RETRIES, waitForWaveformSchedulerAvailability,
  WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS } from '../utils/waveformExtractionLifecycle';
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

interface IdleContention { attempts: number; deadline: number }
const eligibleForIdlePreparation = (song: Song, attempted: Set<string>): boolean => {
  const duration = song.duration ?? song.audioInfo?.durationMs ?? 0;
  return !attempted.has(getWaveformSourceIdentity(song).sourceFingerprint) && Boolean(resolveWaveformUri(song))
    && duration > 0 && duration <= MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS;
};
const waitForIdleRetry = async (fingerprint: string, contention: Map<string, IdleContention>, signal: AbortSignal): Promise<boolean> => {
  const retry = contention.get(fingerprint) ?? { attempts: 0, deadline: Date.now() + WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS };
  retry.attempts += 1; contention.set(fingerprint, retry);
  if (retry.attempts >= MAX_WAVEFORM_CONTENTION_RETRIES || Date.now() >= retry.deadline) return false;
  try { await waitForWaveformSchedulerAvailability(signal, 'background', retry.deadline - Date.now()); return !signal.aborted; }
  catch { return false; }
};
const prepareIdleWaveforms = async (
  songs: Song[], attempted: Set<string>, contention: Map<string, IdleContention>, signal: AbortSignal,
): Promise<boolean> => {
  const candidates = songs.slice().sort((a, b) => (b.fileInfo?.importedAt ?? 0) - (a.fileInfo?.importedAt ?? 0));
  const keys = new Set(candidates.map(song => getWaveformSourceIdentity(song).sourceFingerprint));
  for (const fingerprint of attempted) { if (!keys.has(fingerprint)) attempted.delete(fingerprint); }
  for (const song of candidates) {
    if (signal.aborted) break;
    if (!eligibleForIdlePreparation(song, attempted)) continue;
    const fingerprint = getWaveformSourceIdentity(song).sourceFingerprint;
    const cached = await getCachedWaveformForSong(song).catch(() => null);
    if (signal.aborted) break;
    if (cached?.source === 'native') { attempted.add(fingerprint); continue; }
    let deferred = false;
    const waveform = await extractNativeWaveform(song, song.duration ?? song.audioInfo?.durationMs ?? 0, {
      priority: 'background', signal,
      onDecision: result => { deferred = result.decision === 'native-scheduler-unavailable'
        || result.decision === 'native-scheduler-preempted'; },
    });
    if (signal.aborted) break;
    if (deferred && await waitForIdleRetry(fingerprint, contention, signal)) return true;
    attempted.add(fingerprint);
    if (waveform) await setCachedWaveform(waveform).catch(() => undefined);
  }
  return false;
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
    const contention = new Map<string, IdleContention>();
    const run = async (): Promise<void> => {
      running = true;
      try { wakeRequested = await prepareIdleWaveforms(songsRef.current, attempted.current, contention, signal) || wakeRequested; }
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
