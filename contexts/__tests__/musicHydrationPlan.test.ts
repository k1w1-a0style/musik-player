import { createHydrationPlan } from '../musicHydrationPlan';
import type { Playlist, Song } from '../../types/Song';

const storedDefaults = {
  eqEnabled: null,
  eqBands: null,
  eqPreset: null,
  volume: null,
  repeatMode: null,
  shuffle: false,
};

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///s2.mp3' },
];

const playlists: Playlist[] = [
  { id: 'pl-1', name: 'List', songIds: ['s1', 's2'], createdAt: 1, updatedAt: 1 },
];

describe('musicHydrationPlan', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('plans valid songs, playlists, current song, persistence, and native initialization', () => {
    const plan = createHydrationPlan({ ...storedDefaults, songs, playlists, currentSongId: 's2' }, songs);

    expect(plan.hydratedSongs).toEqual(songs);
    expect(plan.playableQueue.map(song => song.id)).toEqual(['s2', 's1']);
    expect(plan.hydratedQueue.map(song => song.id)).toEqual(['s1', 's2']);
    expect(plan.restoredSong).toEqual(expect.objectContaining({ id: 's2' }));
    expect(plan.currentSongPersistence).toEqual({ action: 'keep' });
    expect(plan.shouldPersistSongs).toBe(false);
    expect(plan.shouldPersistPlaylists).toBe(false);
    expect(plan.nativeQueueAction).toBe('initialize');
  });

  test('plans cleanup when current song id points to a removed or non-playable song', () => {
    const plan = createHydrationPlan({ ...storedDefaults, songs, playlists: null, currentSongId: 's1' }, [
      { id: 's1', title: 'One', artist: 'A', uri: '   ' },
      songs[1],
    ]);

    expect(plan.restoredSong).toBeNull();
    expect(plan.currentSongPersistence).toEqual({
      action: 'remove',
      songId: 's1',
      reason: 'missing-or-not-playable',
    });
    expect(plan.nativeQueueAction).toBe('clearMalformedCurrent');
  });

  test('plans songs and playlist persistence after normalization without visualizer fields', () => {
    const dirtyPlaylist: Playlist = {
      id: 'pl-1',
      name: 'Dirty',
      songIds: [' s1 ', 's1', 'missing'],
      createdAt: 1,
      updatedAt: 1,
    };

    const plan = createHydrationPlan({ ...storedDefaults, songs: [{ ...songs[0], id: ' s1 ' }], playlists: [dirtyPlaylist], currentSongId: ' s1 ' }, [
      { ...songs[0], id: ' s1 ' },
    ]);

    expect(plan.hydratedSongs).toEqual([expect.objectContaining({ id: 's1' })]);
    expect(plan.shouldPersistSongs).toBe(true);
    expect(plan.normalizedPlaylists).toEqual([expect.objectContaining({ id: 'pl-1', songIds: ['s1'] })]);
    expect(plan.shouldPersistPlaylists).toBe(true);
    expect(plan.currentSongPersistence).toEqual({ action: 'set', songId: 's1' });
    expect(Object.keys(plan.hydratedSongs[0])).not.toEqual(expect.arrayContaining(['visualizer', 'fft']));
  });

  test('keeps semantic shuffle queue shape from the hydration transform helpers', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const plan = createHydrationPlan({ ...storedDefaults, songs, playlists: null, shuffle: true, currentSongId: 's2' }, songs);

    expect(plan.playableQueue[0].id).toBe('s2');
    expect(plan.playableQueue.map(song => song.id).sort()).toEqual(['s1', 's2']);
  });
});
