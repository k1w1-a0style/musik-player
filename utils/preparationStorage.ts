import { isAbortError, withTimeout } from './withTimeout';

export const PREPARATION_STORAGE_TIMEOUT_MS = 10_000;
export class PreparationStorageError extends Error {
  constructor() { super('Waveform storage could not complete'); this.name = 'PreparationStorageError'; }
}

/** Bounds the UI wait only; underlying cache writes keep their actual ordered tail. */
export const waitForPreparationStorage = async <T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> => {
  try {
    return await withTimeout(operation, PREPARATION_STORAGE_TIMEOUT_MS,
      'Waveform storage did not respond', { signal });
  } catch (error) {
    if (isAbortError(error) || signal.aborted) throw error;
    throw new PreparationStorageError();
  }
};
