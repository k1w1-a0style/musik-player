import { inspectId3MissingFields, hasLegacyTailMetadata } from '../id3MetadataInspection';
import { buildId3SongPatch, mergeFastMetadataIntoId3Tags } from '../songMetadataRefresh';
import { mergeSongPreservingRichMetadata } from '../libraryPresentation';
import type { Song } from '../../types/Song';

const audio = (): Uint8Array => {
  const bytes = new Uint8Array(834);
  bytes.set([255, 251, 144, 0]);
  bytes.set([255, 251, 144, 0], 417);
  return bytes;
};
const taggedAudio = (frames: number[] = [], flags = 0): Uint8Array =>
  new Uint8Array([73, 68, 51, 3, 0, flags, 0, 0, 0, frames.length, ...frames, ...audio()]);
const song: Song = { id: 'one', title: 'One', artist: 'Artist', album: 'Old', genre: 'Rock', comment: 'Old comment', cover: 'file:///old.jpg' };

test('a complete supported tag proves only absent optional fields', () => {
  const head = taggedAudio([84, 65, 76, 66, 0, 0, 0, 2, 0, 0, 0, 65]);
  expect(inspectId3MissingFields(head, true)).toEqual(['albumArtist', 'year', 'genre', 'trackNumber', 'discNumber', 'comment', 'cover']);
  expect(inspectId3MissingFields(audio(), false)).not.toContain('cover');
});
test.each([taggedAudio([], 128), taggedAudio().subarray(0, 10), new Uint8Array([255, 251, 144, 0]),
  taggedAudio([84, 65, 76, 66, 0, 0, 0, 50, 0, 0]), new Uint8Array([102, 76, 97, 67])])(
  'unsupported, incomplete or foreign metadata never proves absence', bytes => {
    expect(inspectId3MissingFields(bytes, true)).toBeUndefined();
  },
);
test('legacy tail tags prevent an authoritative empty result', () => {
  const tail = new Uint8Array(512);
  tail.set([84, 65, 71], 384);
  expect(hasLegacyTailMetadata(tail)).toBe(true);
  expect(hasLegacyTailMetadata(audio().subarray(-512))).toBe(false);
});
test('manual refresh clears only confirmed absence and keeps native fields', () => {
  const tags = mergeFastMetadataIntoId3Tags({ genre: 'Jazz' }, { metadataInspection: { absentFields: ['album', 'genre', 'comment', 'cover'] } });
  expect(buildId3SongPatch(song, tags)).toEqual({ album: undefined, genre: 'Jazz', comment: undefined,
    cover: undefined, coverInfo: { status: 'none', embeddedArtworkChecked: true } });
  expect(buildId3SongPatch(song, {})).toEqual({});
});
test('rescan receipts do not leak into future partial updates or erase a picked preview', () => {
  const preview = { ...song, coverInfo: { pendingEmbeddedArtworkRefresh: true } };
  const incoming = { ...song, cover: undefined, album: undefined, genre: undefined,
    metadataInspection: { absentFields: ['album', 'cover'] as const } };
  const result = mergeSongPreservingRichMetadata(preview, incoming);
  expect(result.album).toBeUndefined();
  expect(result.genre).toBe('Rock');
  expect(result.cover).toBe(song.cover);
  expect(result.metadataInspection).toBeUndefined();
});
