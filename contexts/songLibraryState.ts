import type { Dispatch, SetStateAction } from 'react';
import type { Song } from '../types/Song';
import type { ImportedSongsDelta } from '../utils/libraryImportFlow';
import { compareSongTitles } from '../utils/libraryPresentation';
import { createImportSongReconciler } from '../utils/libraryImportReconciliation';
import { sameSongSnapshot } from '../utils/songSnapshotEquality';
import { throwIfAborted } from '../utils/withTimeout';
import { protectAcceptedSongCovers } from './songCoverProtectionLifecycle';

export interface SongImportGeneration { controller: AbortController }
export interface SongImportController {
  commitImport: (update: ImportedSongsDelta, generation: SongImportGeneration) => Promise<Song[]>;
  publishImport: () => Song[];
  getCurrent: () => Song[];
  waitForCheckpoints: () => Promise<void>;
}
type CheckpointPersistence = (readCurrent: () => Song[], onConfirmed: (songs: Song[]) => void) => Promise<Song[]>;

/** Rebase a UI edit onto unpublished, durable import additions. */
const rebaseVisibleEdit = (current: Song[], visible: Song[], next: Song[]): Song[] => {
  const versions = new Map(current.map(song => [song.id, song]));
  const wanted = new Map(next.map(song => [song.id, song]));
  const previous = new Map(visible.map(song => [song.id, song]));
  for (const song of visible) if (!wanted.has(song.id)) versions.delete(song.id);
  for (const song of next) {
    if (!sameSongSnapshot(previous.get(song.id), song)) versions.set(song.id, song);
  }
  const ordered: Song[] = [];
  for (const song of next) {
    const latest = versions.get(song.id);
    if (latest) ordered.push(latest);
    versions.delete(song.id);
  }
  return [...ordered, ...versions.values()];
};

export class SongLibraryState implements SongImportController {
  private current: Song[];
  private visible: Song[];
  private confirmed?: Song[];
  private publishedSource?: Song[];
  private listeners = new Set<() => void>();
  private persistence?: CheckpointPersistence;
  private importPublication?: (songs: Song[]) => void;
  private publishingImport = false;
  private checkpoints: Promise<unknown> = Promise.resolve();
  private reconcilers = new WeakMap<AbortController, ReturnType<typeof createImportSongReconciler>>();
  constructor(songs: Song[] = []) { this.current = songs; this.visible = songs; this.publishedSource = songs; }

  getCurrent = (): Song[] => this.current;
  getSnapshot = (): Song[] => this.visible;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  configurePersistence = (persistence?: CheckpointPersistence): void => { this.persistence = persistence; };
  configureImportPublication = (publish: (songs: Song[]) => void): void => { this.importPublication = publish; };
  waitForCheckpoints = async (): Promise<void> => { await this.checkpoints.catch(() => undefined); };

  private publish(songs: Song[]): void {
    if (this.visible === songs) return;
    protectAcceptedSongCovers(songs);
    this.visible = songs;
    this.listeners.forEach(listener => listener());
  }

  setSongs: Dispatch<SetStateAction<Song[]>> = update => {
    if (this.publishingImport && typeof update !== 'function') { this.publish(update); return; }
    this.current = typeof update === 'function' ? update(this.current)
      : this.current === this.publishedSource ? update : rebaseVisibleEdit(this.current, this.visible, update);
    this.publishedSource = this.current;
    this.publish(this.current);
  };

  commitImport = (update: ImportedSongsDelta, generation: SongImportGeneration): Promise<Song[]> => {
    const run = this.checkpoints.catch(() => undefined).then(async () => {
      throwIfAborted(generation.controller.signal);
      const persist = this.persistence;
      if (!persist) throw new Error('Bibliothek ist noch nicht bereit. Bitte den Import erneut starten.');
      let reconcile = this.reconcilers.get(generation.controller);
      if (!reconcile) {
        reconcile = createImportSongReconciler(update.baselineSongs, false);
        this.reconcilers.set(generation.controller, reconcile);
      }
      let observed = this.current;
      let proposed = reconcile(observed, update.importedSongs);
      if (proposed === this.confirmed) return proposed;
      const readProposed = (): Song[] => {
        if (this.current !== observed) {
          proposed = rebaseVisibleEdit(proposed, observed, this.current);
          observed = this.current;
        }
        return proposed;
      };
      const accept = (songs: Song[]): void => { this.current = songs; this.confirmed = songs; };
      // The writer cancels older preparations and retains its lock through real
      // I/O. Ordinary edits during that I/O are included before confirmation.
      try {
        const stored = await persist(readProposed, accept);
        if (this.confirmed !== stored) accept(stored);
        return stored;
      } catch (error) {
        this.reconcilers.delete(generation.controller);
        throw error;
      }
    });
    this.checkpoints = run;
    return run;
  };

  publishImport = (): Song[] => {
    if (this.confirmed === this.current && this.publishedSource !== this.current) {
      this.publishedSource = this.current;
      const visible = this.current.slice().sort(compareSongTitles);
      this.publishingImport = true;
      try {
        if (this.importPublication) this.importPublication(visible);
        else this.publish(visible);
      } finally { this.publishingImport = false; }
    }
    return this.visible;
  };
}

export const createSongLibraryState = (songs: Song[] = []): SongLibraryState => new SongLibraryState(songs);
