import type { PaletteResult } from 'expo-system-audio';
import { storage } from '../utils/storage';
import { assertPersistenceEpoch, capturePersistenceEpoch, trackPersistenceWork } from '../utils/persistenceMaintenance';

export const ALBUM_PALETTE_CACHE_KEY = 'albumPaletteCacheV1';
export const MAX_MEMORY_PALETTES = 512;
export const MAX_PERSISTED_PALETTES = 5000;
export const MAX_PALETTE_CACHE_BYTES = 1_500_000;
const fields = ['dominant', 'vibrant', 'lightVibrant', 'darkVibrant', 'muted', 'lightMuted', 'darkMuted'] as const;
interface CacheEntry { key: string; palette: PaletteResult; bytes: number }
const memory = new Map<string, PaletteResult>();
const persistent = new Map<string, CacheEntry>();
let persistedBytes = 0;
let epoch = capturePersistenceEpoch();
let generation = 0;
let hydration: 'unread' | 'reading' | 'ready' | 'failed' = 'unread';
let readFlight: Promise<void> | undefined;
let writeQueue = Promise.resolve();
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;

export const sanitizePalette = (value: unknown): PaletteResult | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const palette: PaletteResult = {};
  for (const field of fields) {
    const color = source[field];
    if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) palette[field] = color;
  }
  return Object.keys(palette).length ? palette : null;
};
const resetState = (): void => {
  generation += 1;
  memory.clear(); persistent.clear(); persistedBytes = 0;
  hydration = 'unread'; readFlight = undefined; dirty = false;
  clearTimeout(flushTimer); flushTimer = undefined;
};
const ensureEpoch = (): void => {
  const current = capturePersistenceEpoch();
  if (epoch === current) return;
  resetState(); epoch = current;
};
const trimPersistent = (): void => {
  while (persistent.size > MAX_PERSISTED_PALETTES || persistedBytes > MAX_PALETTE_CACHE_BYTES) {
    const oldest = persistent.values().next().value as CacheEntry | undefined;
    if (!oldest) return;
    persistent.delete(oldest.key); persistedBytes -= oldest.bytes;
  }
};
const storePersistent = (key: string, palette: PaletteResult): void => {
  const existing = persistent.get(key);
  if (existing) persistedBytes -= existing.bytes;
  persistent.delete(key);
  const entry = { key, palette, bytes: JSON.stringify({ key, palette }).length };
  persistent.set(key, entry); persistedBytes += entry.bytes; trimPersistent();
};
const safePersistentKey = (key: unknown): key is string => typeof key === 'string'
  && /^cover-v1:[a-f0-9]{32}-[a-f0-9]{32}\.(jpg|png|webp)$/i.test(key);

const mergeStored = (value: unknown): void => {
  const source = value as { version?: number; entries?: { key?: unknown; palette?: unknown }[] } | null;
  if (source?.version !== 1 || !Array.isArray(source.entries)) return;
  const newer = [...persistent.values()];
  persistent.clear(); persistedBytes = 0;
  for (const entry of source.entries.slice(-MAX_PERSISTED_PALETTES)) {
    if (!entry || !safePersistentKey(entry.key)) continue;
    const palette = sanitizePalette(entry.palette);
    if (palette) storePersistent(entry.key, palette);
  }
  newer.forEach(({ key, palette }) => storePersistent(key, palette));
};
export const hydrateAlbumPaletteCache = (): Promise<void> => {
  ensureEpoch();
  if (readFlight) return readFlight;
  const owner = epoch; const captured = generation;
  hydration = 'reading';
  readFlight = storage.get(ALBUM_PALETTE_CACHE_KEY).then(value => {
    assertPersistenceEpoch(owner);
    if (captured !== generation) return;
    mergeStored(value); hydration = 'ready';
    if (dirty) scheduleFlush();
  }).catch(error => {
    if (captured !== generation) return;
    hydration = 'failed';
    console.warn('[AlbumPalette] Cache read failed; preserving stored cache.', error);
  });
  return readFlight;
};
export const readAlbumPaletteCache = (key: string): PaletteResult | null => {
  ensureEpoch();
  const cached = memory.get(key) ?? persistent.get(key)?.palette;
  if (!cached) return null;
  memory.delete(key); memory.set(key, cached);
  while (memory.size > MAX_MEMORY_PALETTES) memory.delete(memory.keys().next().value!);
  const entry = persistent.get(key);
  if (entry) { persistent.delete(key); persistent.set(key, entry); }
  return cached;
};
export const rememberAlbumPaletteCache = (key: string, value: PaletteResult, persistentKey?: string): void => {
  ensureEpoch();
  const palette = sanitizePalette(value);
  if (!palette) return;
  memory.delete(key); memory.set(key, palette);
  while (memory.size > MAX_MEMORY_PALETTES) memory.delete(memory.keys().next().value!);
  if (!persistentKey || !safePersistentKey(persistentKey)) return;
  storePersistent(persistentKey, palette); dirty = true;
  if (hydration === 'ready') scheduleFlush();
};
export const flushAlbumPaletteCache = (): Promise<void> => {
  ensureEpoch(); clearTimeout(flushTimer); flushTimer = undefined;
  if (!dirty || hydration !== 'ready') return writeQueue;
  dirty = false;
  const owner = epoch; const captured = generation;
  const snapshot = { version: 1, entries: [...persistent.values()].map(({ key, palette }) => ({ key, palette })) };
  writeQueue = trackPersistenceWork(writeQueue.catch(() => undefined).then(async () => {
    assertPersistenceEpoch(owner);
    if (captured !== generation) return;
    if (!await storage.set(ALBUM_PALETTE_CACHE_KEY, snapshot)) throw new Error('Palette cache write failed');
  }).catch(error => {
    if (captured === generation) dirty = true;
    console.warn('[AlbumPalette] Optional cache write failed.', error);
  }));
  return writeQueue;
};
function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = undefined; void flushAlbumPaletteCache(); }, 1000);
}
export const getAlbumPaletteCacheStats = () => ({ memoryEntries: memory.size, persistedEntries: persistent.size,
  persistedBytes, hydration });
export const resetAlbumPaletteCacheForTests = (): void => { resetState(); epoch = capturePersistenceEpoch(); };
