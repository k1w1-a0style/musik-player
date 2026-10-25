import { resetImportFileReadsForTests, runImportFileWorkers, withImportFileBudget } from '../libraryImportBudget';
import { throwIfAborted } from '../withTimeout';

beforeEach(() => { jest.useFakeTimers(); resetImportFileReadsForTests(); });
afterEach(() => { jest.useRealTimers(); resetImportFileReadsForTests(); });

test.each([10, 100, 1000])('one scan processes %i healthy files without exceeding two real readers', async count => {
  let active = 0;
  let peak = 0;
  const confirmed: number[] = [];
  const result = runImportFileWorkers(Array.from({ length: count }, (_, i) => i), {
    read: async item => { active++; peak = Math.max(peak, active); await Promise.resolve(); active--; return item; },
    onResult: async item => { confirmed.push(item); }, onFailure: jest.fn(),
  });
  await expect(result).resolves.toEqual({ processed: count, remaining: 0, interrupted: false });
  expect(new Set(confirmed).size).toBe(count);
  expect(peak).toBeLessThanOrEqual(2);
});

test('real phase completions keep slow healthy files alive without extending a stalled phase deadline', async () => {
  const onFailure = jest.fn();
  const onResult = jest.fn();
  const result = runImportFileWorkers([1, 2, 3, 4], {
    perFileTimeoutMs: 10,
    read: async (item, signal, activity) => {
      for (let phase = 0; phase < 4; phase++) {
        await new Promise(resolve => setTimeout(resolve, 6));
        throwIfAborted(signal); activity();
      }
      return item;
    },
    onFailure, onResult,
  });
  await jest.advanceTimersByTimeAsync(60);
  await expect(result).resolves.toEqual({ processed: 4, remaining: 0, interrupted: false });
  expect(onFailure).not.toHaveBeenCalled();
  expect(onResult).toHaveBeenCalledTimes(4);
  expect(jest.getTimerCount()).toBe(0);
});

test('two timed out readers that really settle let the same scan process the healthy tail', async () => {
  const confirmed: number[] = [];
  const failures = jest.fn();
  let active = 0;
  let peak = 0;
  const result = runImportFileWorkers([1, 2, 3, 4, 5, 6], {
    perFileTimeoutMs: 10,
    read: async (item, signal) => {
      active++; peak = Math.max(peak, active);
      try {
        if (item <= 2) await new Promise(resolve => setTimeout(resolve, 12));
        throwIfAborted(signal); return item;
      } finally { active--; }
    },
    onResult: async item => { confirmed.push(item); }, onFailure: failures,
  });
  await jest.advanceTimersByTimeAsync(30);
  await expect(result).resolves.toEqual({ processed: 6, remaining: 0, interrupted: false });
  expect(confirmed).toEqual([3, 4, 5, 6]);
  expect(failures).toHaveBeenCalledTimes(2);
  expect(peak).toBe(2);
});

test('occupied capacity never consumes or reports unattempted files as damaged', async () => {
  const hung = () => new Promise<void>(() => undefined);
  const a = expect(withImportFileBudget(hung, undefined, 10)).rejects.toThrow('Zeitlimits');
  const b = expect(withImportFileBudget(hung, undefined, 10)).rejects.toThrow('Zeitlimits');
  await jest.advanceTimersByTimeAsync(10); await Promise.all([a, b]);
  const read = jest.fn(async () => undefined);
  const onFailure = jest.fn();
  const result = runImportFileWorkers([1, 2, 3, 4], { read, onFailure, perFileTimeoutMs: 10 });
  await jest.advanceTimersByTimeAsync(20);
  await expect(result).resolves.toEqual({ processed: 0, remaining: 4, interrupted: true });
  expect(read).not.toHaveBeenCalled(); expect(onFailure).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('a damaged file does not prevent healthy acknowledgements', async () => {
  const confirmed: number[] = [];
  const onFailure = jest.fn();
  await expect(runImportFileWorkers([1, 2, 3, 4], {
    read: async item => { if (item === 2) throw new Error('damaged'); return item; },
    onResult: async item => { confirmed.push(item); }, onFailure,
  })).resolves.toEqual({ processed: 4, remaining: 0, interrupted: false });
  expect(confirmed.sort()).toEqual([1, 3, 4]); expect(onFailure).toHaveBeenCalledTimes(1);
});
