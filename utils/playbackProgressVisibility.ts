import { useSyncExternalStore } from 'react';

let visible = true;
const listeners = new Set<() => void>();
export const setPlaybackProgressVisible = (next: boolean): void => {
  if (visible === next) return;
  visible = next; listeners.forEach(listener => listener());
};
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener); return () => { listeners.delete(listener); };
};
export const usePlaybackProgressVisible = (): boolean => useSyncExternalStore(subscribe, () => visible, () => visible);
