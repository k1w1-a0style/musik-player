import { useCallback, useRef } from 'react';

export type AsyncGuardedAction = () => Promise<void>;

export const useAsyncInFlightGuard = (): ((action: AsyncGuardedAction) => Promise<void>) => {
  const inFlightRef = useRef(false);

  return useCallback(async (action: AsyncGuardedAction): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await action();
    } finally {
      inFlightRef.current = false;
    }
  }, []);
};
