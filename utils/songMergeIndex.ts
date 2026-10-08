import type { Song } from '../types/Song';

interface Component { parent: number; size: number; song: Song; lastSeen: number }
interface MergeRules {
  keys: (song: Song) => string[];
  merge: (previous: Song | undefined, incoming: Song) => Song;
  compare: (a: Song, b: Song) => number;
}

/** Retains transitive URI/fingerprint/ID aliases across batches. */
export class SongMergeIndex {
  private components: Component[] = [];
  private owners = new Map<string, number>();
  private unsorted?: Song[];
  private sorted?: Song[];
  constructor(private rules: MergeRules, songs: Song[] = []) { this.addAll(songs); }

  private root(index: number): number {
    let root = index;
    while (this.components[root].parent !== root) root = this.components[root].parent;
    while (this.components[index].parent !== index) {
      const parent = this.components[index].parent;
      this.components[index].parent = root;
      index = parent;
    }
    return root;
  }

  private union(left: number, right: number): number {
    left = this.root(left); right = this.root(right);
    if (left === right) return left;
    if (this.components[left].size < this.components[right].size) [left, right] = [right, left];
    this.components[right].parent = left;
    this.components[left].size += this.components[right].size;
    return left;
  }

  addAll(songs: Song[]): void { for (const song of songs) this.add(song); }

  private add(song: Song): void {
    const keys = this.rules.keys(song);
    const index = this.components.length;
    this.components.push({ parent: index, size: 1, song, lastSeen: index });
    const matched = [...new Set(keys.map(key => this.owners.get(key))
      .filter((owner): owner is number => owner !== undefined).map(owner => this.root(owner)))]
      .sort((a, b) => this.components[a].lastSeen - this.components[b].lastSeen);
    const previous = matched.reduce<Song | undefined>((value, root) => this.rules.merge(value, this.components[root].song), undefined);
    let root = index;
    for (const match of matched) root = this.union(root, match);
    this.components[root].song = this.rules.merge(previous, song);
    this.components[root].lastSeen = index;
    for (const key of keys) this.owners.set(key, root);
    this.unsorted = undefined; this.sorted = undefined;
  }

  find(song: Song): Song | undefined {
    const keys = [`id:${song.id}`, ...this.rules.keys(song)];
    for (const key of keys) {
      const owner = this.owners.get(key);
      if (owner !== undefined) return this.components[this.root(owner)].song;
    }
    return undefined;
  }

  snapshot(sorted = true): Song[] {
    this.unsorted ??= [...new Set(this.components.map((_, index) => this.root(index)))]
      .map(root => this.components[root].song);
    if (!sorted) return this.unsorted;
    this.sorted ??= this.unsorted.slice().sort(this.rules.compare);
    return this.sorted;
  }
}
