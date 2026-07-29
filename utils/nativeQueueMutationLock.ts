export interface NativeQueueReplacementContext {
  replacementVersion: number;
  isCurrent: () => boolean;
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
): Promise<T> => {
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
        isCurrent: () => currentAtStart,
      });
    });

  nativeMutationChain = run.catch(() => undefined);
  return run;
};

export const runExclusiveNativePlaybackControl = async <T>(
  action: () => Promise<T>,
): Promise<T> => {
  const run = nativeMutationChain.catch(() => undefined).then(action);
  nativeMutationChain = run.catch(() => undefined);
  return run;
};

export const resetNativeQueueMutationLockForTests = (): void => {
  nativeMutationChain = Promise.resolve();
  nativeQueueReplacementVersion = 0;
};
