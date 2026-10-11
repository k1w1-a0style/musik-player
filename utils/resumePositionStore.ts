import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Song } from '../types/Song';
import { storage } from './storage';
import { assertPersistenceEpoch, capturePersistenceEpoch, trackPersistenceWork } from './persistenceMaintenance';
import { findResumeEntry, getResumeSource, isUsefulResumePosition, parseResumePositions,
  pruneResumeEntries, RESUME_MAX_CODE_UNITS, RESUME_MAX_ENTRIES, RESUME_POSITIONS_KEY, serializeResumePositions, type ResumeEntry } from './resumePosition';

export const RESUME_WRITE_INTERVAL_MS = 15_000;
const rawKey = `@musikplayer:${RESUME_POSITIONS_KEY}`;
const validReceipt = (positionMs: number, durationMs: number, timestamp: number): boolean =>
  Number.isFinite(positionMs) && positionMs >= 0 && Number.isFinite(durationMs) && durationMs > 0
  && Number.isFinite(timestamp) && timestamp >= 0 && timestamp <= Date.now() + 60_000;
export class ResumePositionStore {
  private enabled = false;
  private loaded = false;
  private loadGeneration = 0;
  private loading?: Promise<void>;
  private entries: ResumeEntry[] = [];
  private readonly receipts = new Map<string, number>();
  private ignoreReceiptsBefore = 0;
  private version = 0;
  private confirmedVersion = 0;
  private writer?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly epoch = capturePersistenceEpoch();

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) { clearTimeout(this.timer); this.timer = undefined; }
  }
  private load(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (this.loading) return this.loading;
    const generation = this.loadGeneration;
    const work = (async () => {
      const raw = await AsyncStorage.getItem(rawKey);
      if (generation !== this.loadGeneration) return;
      try { this.entries = parseResumePositions(raw); }
      catch (error) {
        console.warn('[Resume] Invalid stored positions ignored.', error);
        this.entries = [];
      }
      this.loaded = true;
    })();
    this.loading = trackPersistenceWork(work);
    void work.then(() => { if (this.loading === work) this.loading = undefined; },
      () => { if (this.loading === work) this.loading = undefined; });
    return work;
  }
  async lookup(song: Song): Promise<ResumeEntry | undefined> {
    if (!this.enabled) return undefined;
    try {
      await this.load();
      return this.enabled ? findResumeEntry(song, this.entries) : undefined;
    } catch (error) {
      console.warn('[Resume] Stored position could not be read; starting normally.', error);
      return undefined;
    }
  }
  record(song: Song, positionMs: number, durationMs: number, timestamp = Date.now()): Promise<void> {
    if (!this.enabled || !getResumeSource(song)) return Promise.resolve();
    return trackPersistenceWork(this.recordLoaded(song, positionMs, durationMs, timestamp));
  }
  private acceptReceipt(source: string, previous: ResumeEntry | undefined, timestamp: number): boolean {
    const latest = Math.max(this.receipts.get(source) ?? 0, previous?.updatedAt ?? 0, this.ignoreReceiptsBefore);
    if (timestamp < latest) return false;
    this.receipts.delete(source); this.receipts.set(source, timestamp);
    if (this.receipts.size > RESUME_MAX_ENTRIES) this.receipts.delete(this.receipts.keys().next().value!);
    return true;
  }
  private async recordLoaded(song: Song, positionMs: number, durationMs: number, timestamp: number): Promise<void> {
    const generation = this.loadGeneration;
    await this.load();
    if (!this.enabled || generation !== this.loadGeneration) return;
    assertPersistenceEpoch(this.epoch);
    const source = getResumeSource(song);
    if (!source || !validReceipt(positionMs, durationMs, timestamp)) return;
    const previous = this.entries.find(entry => entry.source === source);
    if (!this.acceptReceipt(source, previous, timestamp)) return;
    const oldCount = this.entries.length;
    this.entries = this.entries.filter(entry => entry.source !== source && entry.songId !== song.id);
    if (isUsefulResumePosition(positionMs, durationMs)) {
      this.entries.push({ source, songId: song.id, positionMs: Math.floor(positionMs / 1000) * 1000, durationMs, updatedAt: timestamp });
    } else if (!previous && this.entries.length === oldCount) return;
    this.entries = pruneResumeEntries(this.entries, Date.now());
    while (this.entries.length > 0 && JSON.stringify({ version: 1, entries: this.entries }).length > RESUME_MAX_CODE_UNITS) this.entries.pop();
    this.version += 1;
    this.schedule();
  }
  private schedule(): void {
    if (!this.enabled || this.timer || this.version === this.confirmedVersion) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush().catch(error => console.warn('[Resume] Position could not be saved.', error));
    }, RESUME_WRITE_INTERVAL_MS);
  }
  flush(): Promise<void> {
    clearTimeout(this.timer); this.timer = undefined;
    if (this.writer) return this.writer;
    if (this.version === this.confirmedVersion) return Promise.resolve();
    const work = this.writeLatest();
    this.writer = trackPersistenceWork(work);
    void work.then(() => { if (this.writer === work) this.writer = undefined; },
      () => { if (this.writer === work) this.writer = undefined; });
    return work;
  }
  private async writeLatest(): Promise<void> {
    while (this.confirmedVersion !== this.version) {
      assertPersistenceEpoch(this.epoch);
      const requested = this.version;
      const raw = serializeResumePositions(this.entries);
      if (!await storage.set(RESUME_POSITIONS_KEY, JSON.parse(raw))) throw new Error('Resume position write was not confirmed.');
      if (await AsyncStorage.getItem(rawKey) !== raw) throw new Error('Resume position read-back differs from the requested snapshot.');
      this.confirmedVersion = requested;
    }
  }
  clear(): Promise<void> {
    this.loadGeneration += 1;
    this.ignoreReceiptsBefore = Date.now();
    this.receipts.clear();
    this.loaded = true;
    this.entries = [];
    this.version += 1;
    return this.flush();
  }
}
