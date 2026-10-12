import { throwIfAborted } from './withTimeout';

const MAX_QUICK_SCAN_RECORDS_PER_YIELD = 16;
const MAX_QUICK_SCAN_WORK_MS = 8;

/** Shared by the existing two workers. Immediate revision hits should give the
 * UI a frame after bounded work, without a native timer round-trip per title. */
export const createQuickScanYieldBudget = (): ((signal?: AbortSignal) => Promise<void>) => {
  let records = 0;
  let started = Date.now();
  let yielding: Promise<void> | undefined;
  return async signal => {
    throwIfAborted(signal);
    records += 1;
    if (!yielding && (records >= MAX_QUICK_SCAN_RECORDS_PER_YIELD || Date.now() - started >= MAX_QUICK_SCAN_WORK_MS)) {
      records = 0;
      yielding = new Promise<void>(resolve => setTimeout(resolve, 0)).then(() => {
        started = Date.now(); yielding = undefined;
      });
    }
    if (yielding) await yielding;
    throwIfAborted(signal);
  };
};
