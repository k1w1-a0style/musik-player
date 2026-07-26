import { useEffect, useRef, useState } from 'react';
import type { EqInitResult } from 'expo-system-audio';
import {
  applyNativeEqualizerBands,
  applyNativeEqualizerEnabled,
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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      releaseNativeEqualizer();
    };
  }, []);

  useEffect(() => {
    const generation = initGenerationRef.current + 1;
    initGenerationRef.current = generation;
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
      setEqNative(info);
    });

    // A song/session refresh only cancels the obsolete lookup. It must not
    // release the currently working EQ while the replacement session is being
    // resolved; the serialized helper prevents stale init completion from
    // replacing the newer session.
    return () => controller.abort();
  }, [sessionKey]);

  useEffect(() => {
    applyNativeEqualizerEnabled(eqNative, eqEnabled);
  }, [eqEnabled, eqNative]);

  useEffect(() => {
    applyNativeEqualizerBands(eqNative, eqEnabled, eqBands);
  }, [eqBands, eqEnabled, eqNative]);

  return eqNative;
};
