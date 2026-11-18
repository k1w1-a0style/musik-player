export type SongProcessingPhase = 'capture' | 'metadata' | 'audioInfo' | 'cover';

const active = new Map<string, Map<symbol, SongProcessingPhase>>();
const listeners = new Map<string, Set<() => void>>();

export const getSongProcessingPhase = (uri: string): SongProcessingPhase | undefined => {
  let phase: SongProcessingPhase | undefined;
  active.get(uri)?.forEach(value => { phase = value; });
  return phase;
};

export const subscribeSongProcessing = (uri: string, listener: () => void): (() => void) => {
  const subscribers = listeners.get(uri) ?? new Set();
  subscribers.add(listener);
  listeners.set(uri, subscribers);
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) listeners.delete(uri);
  };
};

/** Each reader releases only its own activity, including on timeout or abort. */
export const beginSongProcessing = (uri: string, phase: SongProcessingPhase): (() => void) => {
  const key = uri.trim();
  if (!key) return () => undefined;
  const previous = getSongProcessingPhase(key);
  const jobs = active.get(key) ?? new Map();
  const job = Symbol(phase);
  jobs.set(job, phase);
  active.set(key, jobs);
  if (phase !== previous) listeners.get(key)?.forEach(listener => listener());

  return () => {
    const before = getSongProcessingPhase(key);
    if (!jobs.delete(job)) return;
    if (!jobs.size) active.delete(key);
    if (getSongProcessingPhase(key) !== before) listeners.get(key)?.forEach(listener => listener());
  };
};

export const withSongProcessing = async <T>(uri: string, phase: SongProcessingPhase, run: () => Promise<T>): Promise<T> => {
  const finish = beginSongProcessing(uri, phase);
  try {
    return await run();
  } finally {
    finish();
  }
};
