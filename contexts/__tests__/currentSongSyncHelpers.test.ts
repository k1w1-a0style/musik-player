import {
  findTrackSongById,
  getTrackIdFromActiveTrackEvent,
  syncCurrentSongFromActiveTrackEvent,
} from '../currentSongSyncHelpers';
import type { Song } from '../../types/Song';

const librarySong: Song = { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' };
const queueSong: Song = { id: 's2', title: 'Two', artist: 'B', uri: 'file:///s2.mp3' };

describe('currentSongSyncHelpers', () => {
  test('gets track id from active track event', () => {
    expect(getTrackIdFromActiveTrackEvent({ track: { id: 's1' } })).toBe('s1');
    expect(getTrackIdFromActiveTrackEvent({ track: { id: 123 } })).toBeUndefined();
    expect(getTrackIdFromActiveTrackEvent({ track: null })).toBeUndefined();
  });

  test('finds tracks across song sources', () => {
    expect(findTrackSongById('s1', [[librarySong], [queueSong]])).toBe(librarySong);
    expect(findTrackSongById('s2', [[librarySong], [queueSong]])).toBe(queueSong);
    expect(findTrackSongById(undefined, [[librarySong]])).toBeUndefined();
    expect(findTrackSongById('missing', [[librarySong]])).toBeUndefined();
  });

  test('syncs current song from active track event', () => {
    const setCurrentSong = jest.fn();
    const persistCurrentSongId = jest.fn(async () => undefined);

    syncCurrentSongFromActiveTrackEvent({
      event: { track: { id: 's2' } },
      songSources: [[librarySong], [queueSong]],
      setCurrentSong,
      persistCurrentSongId,
    });

    expect(setCurrentSong).toHaveBeenCalledWith(queueSong);
    expect(persistCurrentSongId).toHaveBeenCalledWith(queueSong);
  });

  test('ignores unknown track ids', () => {
    const setCurrentSong = jest.fn();
    const persistCurrentSongId = jest.fn(async () => undefined);

    syncCurrentSongFromActiveTrackEvent({
      event: { track: { id: 'missing' } },
      songSources: [[librarySong]],
      setCurrentSong,
      persistCurrentSongId,
    });

    expect(setCurrentSong).not.toHaveBeenCalled();
    expect(persistCurrentSongId).not.toHaveBeenCalled();
  });
});
