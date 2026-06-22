import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSongWaveform, type SongWaveform } from './waveformTypes';

const PREFIX = '@musikplayer:waveform:';
const INDEX_KEY = `${PREFIX}index`;
const MAX_CACHED_WAVEFORMS = 80;

const keyForSource = (sourceKey: string): string => `${PREFIX}${sourceKey}`;

const readIndex = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const writeIndex = async (keys: string[]): Promise<void> => {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([...new Set(keys)].slice(0, MAX_CACHED_WAVEFORMS)));
};

export const getCachedWaveform = async (sourceKey: string): Promise<SongWaveform | null> => {
  if (!sourceKey) return null;
  try {
    const raw = await AsyncStorage.getItem(keyForSource(sourceKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSongWaveform(parsed) && parsed.sourceKey === sourceKey ? parsed : null;
  } catch {
    return null;
  }
};

export const setCachedWaveform = async (waveform: SongWaveform): Promise<void> => {
  if (!isSongWaveform(waveform)) return;
  await AsyncStorage.setItem(keyForSource(waveform.sourceKey), JSON.stringify(waveform));
  const existing = await readIndex();
  const next = [waveform.sourceKey, ...existing.filter(key => key !== waveform.sourceKey)];
  const stale = next.slice(MAX_CACHED_WAVEFORMS);
  await Promise.all(stale.map(key => AsyncStorage.removeItem(keyForSource(key)).catch(() => undefined)));
  await writeIndex(next);
};

export const clearWaveformCache = async (): Promise<void> => {
  const existing = await readIndex();
  await Promise.all(existing.map(key => AsyncStorage.removeItem(keyForSource(key)).catch(() => undefined)));
  await AsyncStorage.removeItem(INDEX_KEY);
};
