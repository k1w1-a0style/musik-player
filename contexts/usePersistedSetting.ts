import { useEffect, type MutableRefObject } from 'react';
import { persistIfChanged } from './musicPersistenceHelpers';

export const usePersistedSetting = <T,>(
  isReady: boolean,
  key: string,
  value: T,
  persistedRefs: MutableRefObject<Record<string, string>>,
): void => {
  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(key, value, persistedRefs.current).catch(() => undefined);
  }, [isReady, key, persistedRefs, value]);
};
