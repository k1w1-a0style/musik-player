import type { Song } from '../types/Song';
import { createWaveformSourceIdentity, getWaveformCanonicalIdentity } from './waveformGenerator';

export interface LibraryWaveformPreloadCandidate {
  song: Song;
  sourceFingerprint: string;
  durationMs: number;
}
interface IndexedSong extends LibraryWaveformPreloadCandidate {
  canonicalIdentity: string;
  attempted: boolean;
}

/** Incremental source/eligibility tracking for immutable library snapshots. */
export class LibraryWaveformPreloadIndex {
  private readonly records = new Map<string, IndexedSong>();
  private readonly pending = new Map<string, IndexedSong>();
  private previousSongs: readonly Song[] | null = null;
  private sourceRevision = 0;
  private ordered: readonly LibraryWaveformPreloadCandidate[] | null = null;

  constructor(private readonly maxDurationMs: number) {}

  private setEligibility(record: IndexedSong): void {
    const eligible = !record.attempted && Boolean(record.song.fileInfo?.uri ?? record.song.uri)
      && Number.isFinite(record.durationMs) && record.durationMs > 0 && record.durationMs <= this.maxDurationMs;
    if (eligible && !this.pending.has(record.sourceFingerprint)) {
      this.pending.set(record.sourceFingerprint, record); this.ordered = null;
    } else if (!eligible && this.pending.delete(record.sourceFingerprint)) this.ordered = null;
  }

  private updateSong(song: Song): boolean {
    const previous = this.records.get(song.id);
    if (previous?.song === song) return false;
    const canonicalIdentity = getWaveformCanonicalIdentity(song);
    const sourceChanged = !previous || previous.canonicalIdentity !== canonicalIdentity;
    if (sourceChanged && previous) this.remove(previous);
    const record: IndexedSong = sourceChanged
      ? { song, canonicalIdentity, ...createWaveformSourceIdentity(canonicalIdentity), durationMs: 0, attempted: false }
      : previous!;
    record.song = song;
    record.durationMs = song.duration ?? song.audioInfo?.durationMs ?? 0;
    this.records.set(song.id, record);
    this.setEligibility(record);
    return sourceChanged;
  }

  private remove(record: IndexedSong): void {
    this.records.delete(record.song.id);
    if (this.pending.delete(record.sourceFingerprint)) this.ordered = null;
  }

  /** Metadata backfill and reordering leave active native work on the same revision. */
  update(songs: readonly Song[]): number {
    if (songs === this.previousSongs) return this.sourceRevision;
    let sourceChanged = false;
    const present = new Set<string>();
    for (const song of songs) {
      present.add(song.id);
      sourceChanged = this.updateSong(song) || sourceChanged;
    }
    for (const [id, record] of this.records) {
      if (!present.has(id)) { this.remove(record); sourceChanged = true; }
    }
    this.previousSongs = songs;
    if (sourceChanged) this.sourceRevision += 1;
    return this.sourceRevision;
  }

  /** Sort only changed pending work, never the whole library on every render/pass. */
  getCandidates(): readonly LibraryWaveformPreloadCandidate[] {
    if (!this.ordered) this.ordered = [...this.pending.values()]
      .sort((a, b) => (b.song.fileInfo?.importedAt ?? 0) - (a.song.fileInfo?.importedAt ?? 0));
    return this.ordered;
  }

  markAttempted(sourceFingerprint: string): void {
    const record = this.pending.get(sourceFingerprint);
    if (!record) return;
    record.attempted = true;
    this.pending.delete(sourceFingerprint); this.ordered = null;
  }

  isPending(sourceFingerprint: string): boolean {
    return this.pending.has(sourceFingerprint);
  }
}
