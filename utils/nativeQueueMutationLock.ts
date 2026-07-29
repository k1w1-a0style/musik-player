import { getNativeHydrationGate, type NativeHydrationGateSnapshot } from './nativeHydrationGate';

export interface NativeQueueReplacementContext {
  replacementVersion: number;
  isCurrent: () => boolean;
}

interface NativeMutationOptions { requireStableReadyHydration?: boolean }

const captureHydrationGate = (options?: NativeMutationOptions): NativeHydrationGateSnapshot | undefined => {
  if (!options?.requireStableReadyHydration) return undefined;
  const gate = getNativeHydrationGate();
  // The public provider guard blocks calls made while hydration is not ready.
  // Keep legacy/internal direct callers usable, but bind every admitted ready
  // action to that exact generation and revision until native execution.
  return gate.owned && gate.status === 'ready' ? gate : undefined;
};

const isCapturedHydrationGateCurrent = (captured?: NativeHydrationGateSnapshot): boolean => {
  if (!captured) return true;
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
  const replacementVersion = markNativeQueueReplacementIntent();
  const run = nativeMutationChain
    .catch(() => undefined)
    .then(() => {
      // Native queue mutations are not cancellable once reset/add/skip has begun.
      // Decide staleness exactly once when this queued action starts: an older
      // action that has not started yet may be skipped, while an active action
      // remains valid until it has restored a truthful native/ref/UI state.
      const currentAtStart = nativeQueueReplacementVersion === replacementVersion;
      return action({
        replacementVersion,
        isCurrent: () => currentAtStart && isCapturedHydrationGateCurrent(hydrationGate),
      });
    });

  nativeMutationChain = run.catch(() => undefined);
  return run;
};

export const runExclusiveNativePlaybackControl = async <T>(
  action: () => Promise<T>,
  options?: NativeMutationOptions,
): Promise<T> => {
  const hydrationGate = captureHydrationGate(options);
  const run = nativeMutationChain.catch(() => undefined).then(() => {
    if (!isCapturedHydrationGateCurrent(hydrationGate)) throw new NativeMutationHydrationStaleError();
    return action();
  });
  nativeMutationChain = run.catch(() => undefined);
  return run;
};

export const resetNativeQueueMutationLockForTests = (): void => {
  nativeMutationChain = Promise.resolve();
  nativeQueueReplacementVersion = 0;
};
