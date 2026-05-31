export interface NativeQueueMutationContext {
  mutationVersion: number;
  isCurrent: () => boolean;
}

let nativeQueueMutationChain: Promise<unknown> = Promise.resolve();
let nativeQueueMutationVersion = 0;

export const getNativeQueueMutationVersion = (): number => nativeQueueMutationVersion;

export const markNativeQueueMutationIntent = (): number => {
  nativeQueueMutationVersion += 1;
  return nativeQueueMutationVersion;
};

export const runExclusiveNativeQueueMutation = async <T>(
  action: (context: NativeQueueMutationContext) => Promise<T>,
): Promise<T> => {
  const mutationVersion = markNativeQueueMutationIntent();
  const run = nativeQueueMutationChain
    .catch(() => undefined)
    .then(() => action({
      mutationVersion,
      isCurrent: () => nativeQueueMutationVersion === mutationVersion,
    }));

  nativeQueueMutationChain = run.catch(() => undefined);
  return run;
};

export const resetNativeQueueMutationLockForTests = (): void => {
  nativeQueueMutationChain = Promise.resolve();
  nativeQueueMutationVersion = 0;
};
