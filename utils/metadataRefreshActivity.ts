import { useSyncExternalStore } from 'react';

/**
 * Tiny global coordination flag so background backfills (cover/audio-info) can
 * pause while a user-triggered manual metadata refresh runs exclusively.
 *
 * The manual refresh is prioritized: it brackets its work with
 * begin/endMetadataRefreshActivity, and the backfill hooks observe the flag and
 * yield until the refresh finishes.
 */
let activeCount = 0;
const listeners = new Set<() => void>();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

export const beginMetadataRefreshActivity = (): void => {
  activeCount += 1;
  notify();
};

export const endMetadataRefreshActivity = (): void => {
  activeCount = Math.max(0, activeCount - 1);
  notify();
};

export const isMetadataRefreshActive = (): boolean => activeCount > 0;

export const subscribeMetadataRefreshActivity = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useMetadataRefreshActive = (): boolean =>
  useSyncExternalStore(subscribeMetadataRefreshActivity, isMetadataRefreshActive, isMetadataRefreshActive);

export const resetMetadataRefreshActivityForTests = (): void => {
  activeCount = 0;
  listeners.clear();
};
