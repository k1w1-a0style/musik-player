import { getNativeHydrationGate, type NativeHydrationGateSnapshot } from './nativeHydrationGate';

export interface NativeQueueReplacementContext {
  replacementVersion: number;
  isCurrent: () => boolean;
}

interface NativeMutationOptions { requireStableReadyHydration?: boolean }
export interface NativePlaybackControlContext { assertHydrationCurrent: () => void }
type CapturedHydrationGate = NativeHydrationGateSnapshot | null | undefined;

const captureHydrationGate = (options?: NativeMutationOptions): CapturedHydrationGate => {
  if (!options?.requireStableReadyHydration) return undefined;
  const gate = getNativeHydrationGate();
  return gate.owned && gate.status === 'ready' ? gate : null;
};

const isCapturedHydrationGateCurrent = (captured: CapturedHydrationGate): boolean => {
  if (captured === undefined) return true;
  if (captured === null) return false;
  const current = getNativeHydrationGate();
  return captured.owned && captured.status === 'ready'
    && current.owned && current.status === 'ready'
    && current.generation === captured.generation && current.revision === captured.revision;
};

export class NativeMutationHydrationStaleError extends Error {
  constructor() {
    super('Native playback action was superseded by a hydration gate change.');
    this.name = 'NativeMutationHydrationStaleError';
  }
}

let nativeMutationChain: Promise<unknown> = Promise.resolve();
let nativeQueueReplacementVersion = 0;

export const getNativeQueueReplacementVersion = (): number => nativeQueueReplacementVersion;

export const markNativeQueueReplacementIntent = (): number => {
  nativeQueueReplacementVersion += 1;
  return nativeQueueReplacementVersion;
};

export const runExclusiveNativeQueueReplacement = async <T>(
  action: (context: NativeQueueReplacementContext) => Promise<T>,
  options?: NativeMutationOptions,
): Promise<T> => {
  const hydrationGate = captureHydrationGate(options);
  if (hydrationGate === null) throw new NativeMutationHydrationStaleError();
  const replacementVersion = markNativeQueueReplacementIntent();
  const run = nativeMutationChain
    .catch(() => undefined)
    .then(() => {
      if (!isCapturedHydrationGateCurrent(hydrationGate)) throw new NativeMutationHydrationStaleError();
      // Native queue mutations are not cancellable once reset/add/skip has begun.
      // Decide staleness exactly once when this queued action starts: an older
      // action that has not started yet may be skipped, while an active action
      // remains valid until it has restored a truthful native/ref/UI state.
      const currentAtStart = nativeQueueReplacementVersion === replacementVersion;
      return action({
        replacementVersion,
        isCurrent: () => currentAtStart,
      });
    });

  nativeMutationChain = run.catch(() => undefined);
  return run;
};

export const runExclusiveNativePlaybackControl = async <T>(
  action: (context: NativePlaybackControlContext) => Promise<T>,
  options?: NativeMutationOptions,
): Promise<T> => {
  const hydrationGate = captureHydrationGate(options);
  if (hydrationGate === null) throw new NativeMutationHydrationStaleError();
  const run = nativeMutationChain.catch(() => undefined).then(() => {
    const assertHydrationCurrent = (): void => {
      if (!isCapturedHydrationGateCurrent(hydrationGate)) throw new NativeMutationHydrationStaleError();
    };
    assertHydrationCurrent();
    return action({ assertHydrationCurrent });
  });
  nativeMutationChain = run.catch(() => undefined);
  return run;
};

export const resetNativeQueueMutationLockForTests = (): void => {
  nativeMutationChain = Promise.resolve();
  nativeQueueReplacementVersion = 0;
};
