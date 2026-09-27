export type WaveformStatus = 'pending' | 'analyzing' | 'ready' | 'unavailable';

const states = new Map<string, WaveformStatus>();
const listeners = new Map<string, Set<() => void>>();

export const getWaveformStatus = (fingerprint: string): WaveformStatus => states.get(fingerprint) ?? 'pending';

export const setWaveformStatus = (fingerprint: string, status: WaveformStatus): void => {
  if (getWaveformStatus(fingerprint) === status) return;
  if (status === 'pending') states.delete(fingerprint);
  else states.set(fingerprint, status);
  listeners.get(fingerprint)?.forEach(listener => listener());
};

export const subscribeWaveformStatus = (fingerprint: string, listener: () => void): (() => void) => {
  const subscribers = listeners.get(fingerprint) ?? new Set();
  subscribers.add(listener);
  listeners.set(fingerprint, subscribers);
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) listeners.delete(fingerprint);
  };
};

export const resetWaveformStatusForTests = (): void => {
  states.clear();
  listeners.clear();
};
