import { getMediaLibraryAuthorization, getMediaLibraryAuthorizationRevision, publishMediaLibraryAuthorization, subscribeMediaLibraryAuthorization } from '../utils/mediaLibraryAuthorizationState';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';

/** Read-only lifecycle checks. Unknown errors retain titles; no permission prompt. */
export const useMediaLibraryAuthorization = (sources: unknown): boolean | undefined => {
  const granted = useSyncExternalStore(subscribeMediaLibraryAuthorization, getMediaLibraryAuthorization);
  useEffect(() => {
    let alive = true;
    let revision = 0;
    const check = async () => {
      const current = ++revision;
      const accessRevision = getMediaLibraryAuthorizationRevision();
      try {
        const result = await MediaLibrary.getPermissionsAsync(false, ['audio']);
        if (alive && current === revision && accessRevision === getMediaLibraryAuthorizationRevision()) publishMediaLibraryAuthorization(result.status === 'granted');
      } catch { if (alive && current === revision && accessRevision === getMediaLibraryAuthorizationRevision()) publishMediaLibraryAuthorization(undefined); }
    };
    void check();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => { alive = false; subscription.remove(); };
  }, [sources]);
  return granted;
};
