export interface PlaybackSelectionSnapshot { target: { id: string; title: string } | null }
let revision = 0;
let snapshot: PlaybackSelectionSnapshot = { target: null };
const listeners = new Set<() => void>();
const notify = (): void => { listeners.forEach(listener => listener()); };
export const getPlaybackSelectionSnapshot = (): PlaybackSelectionSnapshot => snapshot;
export const subscribeToPlaybackSelection = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const beginPlaybackSelection = (song: { id: string; title?: string }): number => {
  revision += 1;
  snapshot = { target: { id: song.id, title: song.title?.trim() || 'Unbekannter Titel' } };
  notify();
  return revision;
};
export const finishPlaybackSelection = (capturedRevision: number): boolean => {
  if (capturedRevision !== revision) return false;
  snapshot = { target: null };
  notify();
  return true;
};
export const withPlaybackSelectionFeedback = <T>(song: { id: string; title?: string } | null, action: () => Promise<T>): Promise<T> => {
  if (!song) return action();
  const capturedRevision = beginPlaybackSelection(song);
  try { return action().finally(() => { finishPlaybackSelection(capturedRevision); }); }
  catch (error) { finishPlaybackSelection(capturedRevision); return Promise.reject(error); }
};
export const resetPlaybackSelectionForTests = (): void => {
  revision += 1;
  snapshot = { target: null };
  notify();
};
