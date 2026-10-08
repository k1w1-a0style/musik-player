import { SystemAudio } from 'expo-system-audio';

type Request = { run: () => Promise<string | null>; resolve: (uri: string | null) => void };
const waiting: Request[] = [];
const pending = new Map<string, Promise<string | null>>();
let active = 0;
const drain = (): void => {
  while (active < 2 && waiting.length) {
    const request = waiting.shift()!;
    active += 1;
    void request.run().catch(() => null).then(request.resolve).finally(() => {
      active -= 1;
      drain();
    });
  }
};

/** Share only in-flight work; completed paths may later be evicted from disk. */
export const requestArtworkThumbnail = (uri: string, size: number, revision: string): Promise<string | null> => {
  if (typeof SystemAudio.createArtworkThumbnail !== 'function') return Promise.resolve(null);
  const key = JSON.stringify([uri, size, revision]);
  const existing = pending.get(key);
  if (existing) return existing;
  if (waiting.length >= 64) return Promise.resolve(null);
  const operation = new Promise<string | null>(resolve => {
    waiting.push({ resolve, run: () => SystemAudio.createArtworkThumbnail(uri, size, revision) });
  });
  pending.set(key, operation);
  void operation.finally(() => { if (pending.get(key) === operation) pending.delete(key); });
  drain();
  return operation;
};
