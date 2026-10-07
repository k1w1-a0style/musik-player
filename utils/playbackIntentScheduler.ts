let intentChain: Promise<void> = Promise.resolve();
let boundary = 0;

export const getPlaybackIntentBoundary = (): number => boundary;

/** Preserve submission order across title selection, transport and queue edits. */
export const enqueuePlaybackIntent = <T>(
  action: () => Promise<T>,
  kind: 'selection' | 'edit' | 'control' | 'navigation' = 'control',
): Promise<T> => {
  if (kind !== 'navigation') boundary += 1;
  const run = intentChain.catch(() => undefined).then(action);
  intentChain = run.then(() => undefined, () => undefined);
  return run;
};

export const resetPlaybackIntentSchedulerForTests = (): void => {
  intentChain = Promise.resolve();
  boundary = 0;
};
