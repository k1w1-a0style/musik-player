import { getNativeHydrationGate, type NativeHydrationGateSnapshot } from './nativeHydrationGate';

export interface NativeQueueReplacementContext {
  replacementVersion: number;
  isCurrent: () => boolean;
  beginNativeMutation: () => void;
}

export type NativeHydrationCapture = NativeHydrationGateSnapshot | null | undefined;
interface NativeMutationOptions {
  requireStableReadyHydration?: boolean;
  hydrationCapture?: NativeHydrationCapture;
}
export interface NativePlaybackControlContext { assertHydrationCurrent: () => void }

export const captureRequiredNativeHydration = (): NativeHydrationCapture => {
  const gate = getNativeHydrationGate();
  return gate.owned && gate.status === 'ready' ? gate : null;
};

const captureHydrationGate = (options?: NativeMutationOptions): NativeHydrationCapture => {
  if (options && 'hydrationCapture' in options) return options.hydrationCapture;
  if (!options?.requireStableReadyHydration) return undefined;
  return captureRequiredNativeHydration();
};

const isCapturedHydrationGateCurrent = (captured: NativeHydrationCapture): boolean => {
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
      // Explicitly protected queue intents use two phases. Legacy/internal
      // replacements preserve their historical callback-start semantics.
      let mutationStarted = false;
      const legacyCurrentAtStart = hydrationGate === undefined
        ? nativeQueueReplacementVersion === replacementVersion
        : undefined;
      const isCurrent = (): boolean => legacyCurrentAtStart ?? (mutationStarted || (
        nativeQueueReplacementVersion === replacementVersion
        && isCapturedHydrationGateCurrent(hydrationGate)
      ));
      const beginNativeMutation = (): void => {
        if (mutationStarted) return;
        if (!isCurrent()) throw new NativeMutationHydrationStaleError();
        mutationStarted = true;
      };
      return action({
        replacementVersion,
        isCurrent,
        beginNativeMutation,
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
