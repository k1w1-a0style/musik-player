const writeLocksByUri = new Map<string, Promise<void>>();

/**
 * Serializes tag writes per URI. Callers must always await this promise;
 * fire-and-forget usage is forbidden because it can release UI/persistence flows
 * before native file replacement has settled. The callback must not
 * intentionally start concurrent writes for the same URI outside this lock.
 */
export const withUriWriteLock = async <T>(
  uri: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const previous = writeLocksByUri.get(uri) ?? Promise.resolve();
  let releaseCurrent: (() => void) | undefined;
  const current = new Promise<void>(resolve => {
    releaseCurrent = resolve;
  });
  const queueTail = previous.then(() => current);
  writeLocksByUri.set(uri, queueTail);
  await previous;
  try {
    return await operation();
  } finally {
    releaseCurrent?.();
    if (writeLocksByUri.get(uri) === queueTail) writeLocksByUri.delete(uri);
  }
};
