export type WaveformStatus = 'pending' | 'analyzing' | 'ready' | 'unavailable';

const states = new Map<string, WaveformStatus>();
const progress = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

export const getWaveformStatus = (fingerprint: string): WaveformStatus => states.get(fingerprint) ?? 'pending';
export const getWaveformProgress = (fingerprint: string): number | null => progress.get(fingerprint) ?? null;

export const setWaveformProgress = (fingerprint: string, ratio: number): void => {
  if (!Number.isFinite(ratio) || getWaveformStatus(fingerprint) !== 'analyzing') return;
  const next = Math.max(progress.get(fingerprint) ?? 0, Math.max(0, Math.min(1, ratio)));
  if (progress.get(fingerprint) === next) return;
  progress.set(fingerprint, next);
  listeners.get(fingerprint)?.forEach(listener => listener());
};

export const setWaveformStatus = (fingerprint: string, status: WaveformStatus): void => {
  if (getWaveformStatus(fingerprint) === status) return;
  if (status !== 'ready') progress.delete(fingerprint);
  if (status === 'ready') progress.set(fingerprint, 1);
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
  progress.clear();
  listeners.clear();
};
