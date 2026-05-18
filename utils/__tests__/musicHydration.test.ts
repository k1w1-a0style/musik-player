import { buildHydratedPlaybackQueue, didSongCoversChange } from '../musicHydration';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A' },
  { id: 's3', title: 'Three', artist: 'B', uri: 'file:///s3.mp3' },
  { id: 's4', title: 'Four', artist: 'B', uri: 'file:///s4.mp3' },
];

describe('musicHydration helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('builds playable hydration queue and restores current song order', () => {
    const result = buildHydratedPlaybackQueue(songs, 's3', false);

    expect(result.hydratedQueue.map(song => song.id)).toEqual(['s1', 's3', 's4']);
    expect(result.orderedQueue.map(song => song.id)).toEqual(['s3', 's4', 's1']);
    expect(result.restoredSong?.id).toBe('s3');
    expect(result.shouldClearPersistedCurrentSongId).toBe(false);
  });

  test('marks missing persisted current song for cleanup', () => {
    const result = buildHydratedPlaybackQueue(songs, 'missing', false);

    expect(result.restoredSong).toBeUndefined();
    expect(result.shouldClearPersistedCurrentSongId).toBe(true);
    expect(result.orderedQueue.map(song => song.id)).toEqual(['s1', 's3', 's4']);
  });

  test('keeps restored current song first while shuffle is enabled', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const result = buildHydratedPlaybackQueue(songs, 's3', true);

    expect(result.orderedQueue[0].id).toBe('s3');
    expect(result.orderedQueue.map(song => song.id).sort()).toEqual(['s1', 's3', 's4']);
  });

  test('detects changed cover fields', () => {
    expect(didSongCoversChange([{ ...songs[0], cover: 'b' }], [{ ...songs[0], cover: 'a' }])).toBe(true);
    expect(didSongCoversChange([{ ...songs[0], cover: 'a' }], [{ ...songs[0], cover: 'a' }])).toBe(false);
  });
});
