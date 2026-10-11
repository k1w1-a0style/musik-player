// Operations remain registered until their real promise settles. A UI timeout
// must never release a writer while native storage can still complete later.
const pending = new Set<Promise<unknown>>();
const flushers = new Set<() => void>();
let epoch = 0;
let blocked = false;
export const capturePersistenceEpoch = (): number => epoch;
export const assertPersistenceEpoch = (owner: number): void => {
  if (owner !== epoch || blocked) throw new Error('Dieser Speichervorgang gehört zu einem abgelösten Appzustand.');
};
export const trackPersistenceWork = <T,>(work: Promise<T>): Promise<T> => {
  pending.add(work);
  void work.then(() => pending.delete(work), () => pending.delete(work));
  return work;
};
export const registerPersistenceFlusher = (flush: () => void): (() => void) => {
  flushers.add(flush);
  return () => { flushers.delete(flush); };
};
export const flushPersistenceOwners = (): void => { [...flushers].forEach(flush => flush()); };
export const waitForPersistenceWork = async (): Promise<void> => {
  while (pending.size > 0) await Promise.allSettled([...pending]);
};
export const blockPersistenceForMaintenance = (): void => { blocked = true; epoch += 1; };
export const releasePersistenceMaintenance = (): void => { blocked = false; };
export const assertPersistenceWritable = (): void => {
  if (blocked) throw new Error('Backup-Wiederherstellung hält den Speicher vorübergehend gesperrt.');
};
