import type { CleanerSnapshot, CleanerInventory } from '../types/TagCleaner';
export interface CleanerReadAdapter {
  info(uri: string): Promise<{ exists: boolean; size?: number; modificationTime?: number; isDirectory?: boolean }>;
  range(uri: string, position: number, length: number): Promise<Uint8Array>;
}
export interface CleanerRangeReader { read(position: number, length: number): Promise<Uint8Array>; size: number }
export const CLEANER_READ_BUDGET = 2 * 1024 * 1024;
export const CLEANER_TEXT_BUDGET = 64 * 1024;
export const addCleanerInventory = (inventory: CleanerInventory[], id: string, value?: string): void => {
  let item = inventory.find(entry => entry.id === id);
  if (!item) { item = { id, count: 0 }; inventory.push(item); }
  item.count += 1;
  if (value !== undefined) item.values = [...(item.values ?? []), value];
};
export const emptyCleanerSnapshot = (): CleanerSnapshot => ({ tags: {}, inventory: [], verified: true });
export const cleanerAscii = (bytes: Uint8Array, start = 0, length = 4): string =>
  Array.from(bytes.subarray(start, start + length), byte => String.fromCharCode(byte)).join('');
