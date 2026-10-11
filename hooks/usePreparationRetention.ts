import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { Song } from '../types/Song';
import { getCompatibleWaveformSourceIdentities } from '../utils/waveformGenerator';
import { flushPreparedSources, retainPreparedSources } from '../utils/songPreparationStore';
import { retainWaveformStatuses } from '../utils/waveformStatus';

const sourceKeys = new WeakMap<Song, string[]>();
const getKeys = (song: Song): string[] => {
  let keys = sourceKeys.get(song);
  if (!keys) { keys = getCompatibleWaveformSourceIdentities(song).map(value => value.sourceFingerprint); sourceKeys.set(song, keys); }
  return keys;
};

/** Authoritative ready library revisions govern optional history, never audio/cache payloads. */
export const usePreparationRetention = (ready: boolean, songs: Song[]): void => {
  useEffect(() => {
    if (!ready) return;
    const keys = new Set<string>();
    songs.forEach(song => getKeys(song).forEach(key => keys.add(key)));
    retainPreparedSources(keys);
    retainWaveformStatuses(keys);
  }, [ready, songs]);
  useEffect(() => {
    const flush = (): void => { void flushPreparedSources().catch(error => {
      console.warn('[Preparation] Completion flush failed.', error);
    }); };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') flush(); });
    return () => { subscription.remove(); flush(); };
  }, []);
};
