import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { applyVolumeToTrackPlayer } from './playbackControlHelpers';

interface PendingVolumeWrite {
  value: number;
  requestId: number;
  waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }>;
}

interface SerializedVolumeWriter {
  confirmedVolumeRef: MutableRefObject<number>;
  setVolume: (volume: number) => Promise<void>;
}

export const useSerializedVolumeWriter = (
  isMountedRef: MutableRefObject<boolean>,
  setVolumeValue: Dispatch<SetStateAction<number>>,
): SerializedVolumeWriter => {
  const confirmedVolumeRef = useRef(1);
  const requestIdRef = useRef(0);
  const pendingWriteRef = useRef<PendingVolumeWrite | null>(null);
  const isWriteRunningRef = useRef(false);

  const setVolume = useCallback((nextVolume: number): Promise<void> => {
    const value = Math.max(0, Math.min(1, Number.isFinite(nextVolume) ? nextVolume : 1));
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (isMountedRef.current) setVolumeValue(value);

    const request = new Promise<void>((resolve, reject) => {
      const pending = pendingWriteRef.current;
      if (pending) {
        pending.value = value;
        pending.requestId = requestId;
        pending.waiters.push({ resolve, reject });
      } else {
        pendingWriteRef.current = { value, requestId, waiters: [{ resolve, reject }] };
      }
    });

    if (!isWriteRunningRef.current) {
      isWriteRunningRef.current = true;
      void (async () => {
        while (pendingWriteRef.current) {
          const write = pendingWriteRef.current;
          pendingWriteRef.current = null;
          try {
            confirmedVolumeRef.current = await applyVolumeToTrackPlayer(write.value);
            write.waiters.forEach(waiter => waiter.resolve());
          } catch (error) {
            if (write.requestId === requestIdRef.current && isMountedRef.current) {
              setVolumeValue(confirmedVolumeRef.current);
            }
            write.waiters.forEach(waiter => waiter.reject(error));
          }
        }
        isWriteRunningRef.current = false;
      })();
    }
    return request;
  }, [isMountedRef, setVolumeValue]);

  return { confirmedVolumeRef, setVolume };
};
