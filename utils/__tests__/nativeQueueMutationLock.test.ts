import {
  getNativeQueueReplacementVersion,
  resetNativeQueueMutationLockForTests,
  runExclusiveNativePlaybackControl,
  runExclusiveNativeQueueReplacement,
} from '../nativeQueueMutationLock';

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('nativeQueueMutationLock', () => {
  beforeEach(() => {
    resetNativeQueueMutationLockForTests();
  });

  test('playback controls serialize without invalidating an active queue replacement', async () => {
    const events: string[] = [];
    let replacementIsCurrentAfterControlIntent = false;
    let control: Promise<void> | undefined;

    const replacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      events.push('replacement:start');
      control = runExclusiveNativePlaybackControl(async () => {
        events.push('control');
      });

      await flushMicrotasks();
      replacementIsCurrentAfterControlIntent = isCurrent();
      events.push('replacement:end');
    });

    await replacement;
    await control;

    expect(replacementIsCurrentAfterControlIntent).toBe(true);
    expect(getNativeQueueReplacementVersion()).toBe(1);
    expect(events).toEqual(['replacement:start', 'replacement:end', 'control']);
  });

  test('newer queue replacement intents still invalidate older replacements', async () => {
    let releaseFirstReplacement: () => void = () => undefined;
    let firstReplacementIsCurrent = true;
    let secondReplacementIsCurrent = false;

    const firstReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      await new Promise<void>(resolve => {
        releaseFirstReplacement = resolve;
      });
      firstReplacementIsCurrent = isCurrent();
    });

    await flushMicrotasks();

    const secondReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
      secondReplacementIsCurrent = isCurrent();
    });

    releaseFirstReplacement();
    await Promise.all([firstReplacement, secondReplacement]);

    expect(firstReplacementIsCurrent).toBe(false);
    expect(secondReplacementIsCurrent).toBe(true);
    expect(getNativeQueueReplacementVersion()).toBe(2);
  });
});
