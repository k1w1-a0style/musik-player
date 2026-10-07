import { useEffect, useRef, useState } from 'react';
import type { EqInitResult } from 'expo-system-audio';
import {
  applyNativeEqualizerEnabled,
  createNativeEqualizerBandScheduler,
  initNativeEqualizer,
  releaseNativeEqualizer,
} from './nativeEqualizerHelpers';

export const useNativeEqualizer = (
  eqEnabled: boolean,
  eqBands: number[],
  sessionKey: string | null = null,
): EqInitResult | null => {
  const [eqNative, setEqNative] = useState<EqInitResult | null>(null);
  const mountedRef = useRef(false);
  const initGenerationRef = useRef(0);
  const currentNativeRef = useRef<EqInitResult | null>(null);
  const [bandScheduler] = useState(() => createNativeEqualizerBandScheduler(
    info => mountedRef.current && currentNativeRef.current === info,
  ));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      currentNativeRef.current = null;
      bandScheduler.cancel();
      releaseNativeEqualizer();
    };
  }, [bandScheduler]);

  useEffect(() => {
    const generation = initGenerationRef.current + 1;
    initGenerationRef.current = generation;
    currentNativeRef.current = null;
    bandScheduler.cancel();
    const controller = new AbortController();

    void initNativeEqualizer(controller.signal).then(info => {
      if (!mountedRef.current) {
        // A native init may have completed after the final unmount. The native
        // module is a singleton, so releasing twice is harmless and prevents a
        // session-bound effect from leaking after the provider is gone.
        releaseNativeEqualizer();
        return;
      }
      if (initGenerationRef.current !== generation) return;
      if (!info) releaseNativeEqualizer();
      // Each accepted initialization owns a distinct identity, even if a mock
      // or bridge reuses its result object. Timed writes from an older session
      // must never reach the replacement effect.
      const acceptedInfo = info ? { ...info } : null;
      currentNativeRef.current = acceptedInfo;
      setEqNative(acceptedInfo);
    });

    // A song/session refresh only cancels the obsolete lookup. It must not
    // release the currently working EQ while the replacement session is being
    // resolved; the serialized helper prevents stale init completion from
    // replacing the newer session.
    return () => {
      controller.abort();
      if (initGenerationRef.current === generation) currentNativeRef.current = null;
      bandScheduler.cancel();
    };
  }, [bandScheduler, sessionKey]);

  useEffect(() => {
    applyNativeEqualizerEnabled(eqNative, eqEnabled);
  }, [eqEnabled, eqNative]);

  useEffect(() => {
    bandScheduler.schedule(eqNative, eqEnabled, eqBands);
  }, [bandScheduler, eqBands, eqEnabled, eqNative]);

  return eqNative;
};
