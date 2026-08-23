import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { persistIfChanged } from './musicPersistenceHelpers';

export interface UsePersistedSettingOptions {
  debounceMs?: number;
}

interface LatestPersistence<T> {
  isReady: boolean;
  key: string;
  value: T;
  persistedRefs: MutableRefObject<Record<string, string>>;
}

export const usePersistedSetting = <T,>(
  isReady: boolean,
  key: string,
  value: T,
  persistedRefs: MutableRefObject<Record<string, string>>,
  options: UsePersistedSettingOptions = {},
): void => {
  const latestRef = useRef<LatestPersistence<T>>({ isReady, key, value, persistedRefs });
  latestRef.current = { isReady, key, value, persistedRefs };
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestedDebounceMs = options.debounceMs ?? 0;
  const debounceMs = Number.isFinite(requestedDebounceMs)
    ? Math.max(0, requestedDebounceMs)
    : 0;

  const persistLatest = useCallback((): void => {
    const latest = latestRef.current;
    if (!latest.isReady) return;
    void persistIfChanged(latest.key, latest.value, latest.persistedRefs.current).catch(() => undefined);
  }, []);

  // This effect is intentionally registered before the scheduling effect. On
  // unmount it flushes the latest pending slider value before the timer cleanup.
  useEffect(() => () => {
    if (timerRef.current === undefined) return;
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    persistLatest();
  }, [persistLatest]);

  useEffect(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (!isReady) return;
    if (debounceMs === 0) {
      persistLatest();
      return;
    }

    const timer = setTimeout(() => {
      if (timerRef.current !== timer) return;
      timerRef.current = undefined;
      persistLatest();
    }, debounceMs);
    timerRef.current = timer;

    return () => {
      if (timerRef.current !== timer) return;
      clearTimeout(timer);
      timerRef.current = undefined;
    };
  }, [debounceMs, isReady, key, persistedRefs, persistLatest, value]);
};
