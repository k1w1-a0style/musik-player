import type { Song } from '../../types/Song';
import type { SongMetadataRefreshResult } from '../../utils/songMetadataRefresh';
import {
  mergeMetadataRefreshResult,
  type MetadataRefreshChunkItem,
} from '../libraryMetadataRefreshResultMerge';

const song = (id: string, title = id): Song => ({ id, title, artist: 'Artist' });

const makeResult = (
  overrides: Partial<SongMetadataRefreshResult> = {},
): SongMetadataRefreshResult => ({
  songs: [song('a'), song('b'), song('c')],
  updated: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  errorDetails: [],
  patchesBySongId: {},
  processed: 0,
  total: 3,
  completed: false,
  processedIndexes: [],
  ...overrides,
});

const CHUNK_ITEMS: MetadataRefreshChunkItem[] = [
  { originalIndex: 2, processingPosition: 0 },
  { originalIndex: 0, processingPosition: 1 },
];

describe('mergeMetadataRefreshResult', () => {
  test('merges chunk songs, counters, errors, patches, flags and remapped indexes', () => {
    const current = makeResult({
      updated: 1,
      skipped: 2,
      failed: 3,
      errors: ['current-error'],
      errorDetails: [{ uri: 'current-uri', reason: 'current-reason' }],
      patchesBySongId: {
        a: { title: 'Current A' },
        shared: { artist: 'Current Artist' },
      },
      processed: 4,
      timedOut: true,
      lastProcessedSongId: 'b',
      processedIndexes: [2, 0],
    });
    const chunk = makeResult({
      songs: [song('c', 'Updated C'), song('a', 'Updated A')],
      updated: 5,
      skipped: 6,
      failed: 7,
      errors: ['chunk-error'],
      errorDetails: [{ uri: 'chunk-uri', reason: 'chunk-reason' }],
      patchesBySongId: {
        c: { title: 'Updated C' },
        shared: { artist: 'Chunk Artist' },
      },
      processed: 2,
      aborted: true,
      lastProcessedSongId: 'a',
      processedIndexes: [0, 1, 99],
    });

    expect(mergeMetadataRefreshResult(current, chunk, CHUNK_ITEMS)).toEqual({
      songs: [song('a', 'Updated A'), song('b'), song('c', 'Updated C')],
      updated: 6,
      skipped: 8,
      failed: 10,
      errors: ['current-error', 'chunk-error'],
      errorDetails: [
        { uri: 'current-uri', reason: 'current-reason' },
        { uri: 'chunk-uri', reason: 'chunk-reason' },
      ],
      patchesBySongId: {
        a: { title: 'Current A' },
        c: { title: 'Updated C' },
        shared: { artist: 'Chunk Artist' },
      },
      processed: 6,
      total: 3,
      completed: false,
      timedOut: true,
      aborted: true,
      lastProcessedSongId: 'a',
      processedIndexes: [0, 1, 2],
    });
  });

  test('uses chunk length as processed fallback and preserves undefined optional flags', () => {
    const current = makeResult({ processed: 1, lastProcessedSongId: 'b' });
    const chunk = makeResult({
      songs: [song('c', 'Updated C')],
      processed: undefined as unknown as number,
      processedIndexes: undefined,
      lastProcessedSongId: undefined,
    });

    expect(mergeMetadataRefreshResult(current, chunk, CHUNK_ITEMS)).toMatchObject({
      processed: 2,
      timedOut: undefined,
      aborted: undefined,
      lastProcessedSongId: 'b',
      processedIndexes: [],
    });
  });

  test('ignores chunk songs without a matching placement item', () => {
    const current = makeResult();
    const chunk = makeResult({ songs: [song('c', 'Updated C'), song('a', 'Updated A')] });

    expect(mergeMetadataRefreshResult(current, chunk, CHUNK_ITEMS.slice(0, 1)).songs).toEqual([
      song('a'),
      song('b'),
      song('c', 'Updated C'),
    ]);
  });
});
