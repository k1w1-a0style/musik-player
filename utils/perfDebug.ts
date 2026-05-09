const PERF_GLOBAL_FLAG = '__KIWI_PERF_LOGS__';

type PerfGlobal = typeof globalThis & {
  [PERF_GLOBAL_FLAG]?: boolean;
};

export const shouldLogPerf = (): boolean => __DEV__ && Boolean((globalThis as PerfGlobal)[PERF_GLOBAL_FLAG]);

