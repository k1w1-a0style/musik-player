const listeners = new Set<() => void>();

export const subscribeProgressMutation = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** A confirmed seek invalidates UI snapshots; observer failures cannot fail playback. */
export const notifyProgressMutation = (): void => {
  for (const listener of listeners) {
    try { listener(); }
    catch { console.warn('[PlaybackProgress] Observer refresh failed.'); }
  }
};
