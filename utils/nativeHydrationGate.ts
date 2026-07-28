export type NativeHydrationGateStatus = 'loading' | 'ready' | 'degraded' | 'retry-required';
export interface NativeHydrationGateOwner { readonly generation: number }
export interface NativeHydrationGateSnapshot { status: NativeHydrationGateStatus; generation: number; revision: number; owned: boolean }

let generation = 0;
let ownerGeneration: number | null = null;
let status: NativeHydrationGateStatus = 'loading';
let revision = 0;

export const acquireNativeHydrationGate = (): NativeHydrationGateOwner => {
  generation += 1;
  ownerGeneration = generation;
  status = 'loading';
  revision += 1;
  return { generation };
};

export const publishNativeHydrationGate = (owner: NativeHydrationGateOwner, next: NativeHydrationGateStatus): boolean => {
  if (ownerGeneration !== owner.generation) return false;
  status = next;
  revision += 1;
  return true;
};

export const releaseNativeHydrationGate = (owner: NativeHydrationGateOwner): boolean => {
  if (ownerGeneration !== owner.generation) return false;
  ownerGeneration = null;
  status = 'loading';
  revision += 1;
  return true;
};

export const getNativeHydrationGate = (): NativeHydrationGateSnapshot => ({
  status, generation, revision, owned: ownerGeneration !== null,
});

export const isNativeHydrationReady = (): boolean => status === 'ready' && ownerGeneration !== null;

export const resetNativeHydrationGateForTests = (): void => {
  generation = 0;
  ownerGeneration = null;
  status = 'loading';
  revision = 0;
};
