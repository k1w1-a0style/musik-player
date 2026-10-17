import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert } from 'react-native';
import { assertPersistenceEpoch, capturePersistenceEpoch, trackPersistenceWork } from '../utils/persistenceMaintenance';

const showPreferenceWriteFailure = (retry:()=>void):void => Alert.alert('Einstellung nicht gespeichert',
  'Die letzte bestätigte Auswahl wurde wiederhergestellt.', [{text:'OK',style:'cancel'},{text:'Erneut versuchen',onPress:retry}]);

interface HydratedStoredPreferenceOptions<T> {
  defaultValue: T;
  load: () => Promise<T>;
  persist: (value: T) => Promise<void>;
  normalize: (value: T) => T;
  label: string;
}

export interface HydratedStoredPreference<T> {
  value: T;
  setValue: Dispatch<SetStateAction<T>>;
  isHydrated: boolean;
}

/**
 * Hydrates one stored UI preference without allowing a late read to overwrite
 * a newer user action. Writes are serialized and only the latest failed
 * request may roll the visible value back to the last confirmed value.
 */
export const useHydratedStoredPreference = <T,>({
  defaultValue,
  load,
  persist,
  normalize,
  label,
}: HydratedStoredPreferenceOptions<T>): HydratedStoredPreference<T> => {
  const normalizedDefault = normalize(defaultValue);
  const [value, setValueState] = useState<T>(normalizedDefault);
  const [isHydrated, setIsHydrated] = useState(false);
  const mountedRef = useRef(false);
  const retryRef = useRef<Dispatch<SetStateAction<T>>>(()=>undefined);
  const valueRef = useRef<T>(normalizedDefault);
  const persistedValueRef = useRef<T>(normalizedDefault);
  const requestIdRef = useRef(0);
  const successfulRequestIdRef = useRef(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const epochRef = useRef(capturePersistenceEpoch());
  useEffect(() => {
    mountedRef.current = true;
    const requestIdAtStart = requestIdRef.current, successfulRequestIdAtStart = successfulRequestIdRef.current;

    void load()
      .then(storedValue => {
        if (!mountedRef.current) return;
        const normalizedStored = normalize(storedValue);

        if (requestIdRef.current === requestIdAtStart) {
          valueRef.current = normalizedStored;
          persistedValueRef.current = normalizedStored;
          setValueState(normalizedStored);
        } else if (successfulRequestIdRef.current === successfulRequestIdAtStart) {
          // A pending user write keeps the stored value as rollback target;
          // never display it over the user's newer choice.
          persistedValueRef.current = normalizedStored;
        }
      })
      .catch(error => {
        console.warn(`[Preference:${label}] Failed to hydrate stored value.`, error);
      })
      .finally(() => {
        if (mountedRef.current) setIsHydrated(true);
      });

    return () => {
      mountedRef.current = false;
    };
  }, [label, load, normalize]);
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const requested = typeof action === 'function'
      ? (action as (previousValue: T) => T)(valueRef.current)
      : action;
    const next = normalize(requested);
    const requestId = ++requestIdRef.current;
    valueRef.current = next;
    if (mountedRef.current) setValueState(next);
    writeQueueRef.current = trackPersistenceWork(writeQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          assertPersistenceEpoch(epochRef.current);
          await persist(next);
          successfulRequestIdRef.current = requestId;
          persistedValueRef.current = next;
        } catch (error) {
          console.warn(`[Preference:${label}] Failed to persist value; restoring last confirmed value.`, error);
          if (mountedRef.current && requestIdRef.current === requestId) {
            const fallback = persistedValueRef.current;
            valueRef.current = fallback;
            setValueState(fallback);
            showPreferenceWriteFailure(() => {
              if (mountedRef.current && requestIdRef.current === requestId) retryRef.current(next);
            });
          }
        }
      }));
  }, [label, normalize, persist]);
  retryRef.current = setValue;
  return { value, setValue, isHydrated };
};
