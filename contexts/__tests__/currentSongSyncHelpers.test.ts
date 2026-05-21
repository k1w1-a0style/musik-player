import {
  findTrackSongById,
  getTrackIdFromActiveTrackEvent,
  parseActiveTrackEvent,
  syncCurrentSongFromActiveTrackEvent,
} from '../currentSongSyncHelpers';
import type { Song } from '../../types/Song';

const librarySong: Song = { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' };
const queueSong: Song = { id: 's2', title: 'Two', artist: 'B', uri: 'file:///s2.mp3' };
const numericSong: Song = { id: '123', title: 'Numeric', artist: 'C', uri: 'file:///123.mp3' };

describe('currentSongSyncHelpers', () => {
  test('parses active track events defensively', () => {
    expect(parseActiveTrackEvent({ track: { id: ' s1 ' } })).toEqual({ kind: 'track', trackId: 's1' });
    expect(parseActiveTrackEvent({ trackId: 's2' })).toEqual({ kind: 'track', trackId: 's2' });
    expect(parseActiveTrackEvent({ track: 123 })).toEqual({ kind: 'track', trackId: '123' });
    expect(parseActiveTrackEvent({ track: null })).toEqual({ kind: 'clear' });
    expect(parseActiveTrackEvent({ track: {} })).toEqual({ kind: 'clear' });
    expect(parseActiveTrackEvent({})).toEqual({ kind: 'ignore' });
    expect(parseActiveTrackEvent(null)).toEqual({ kind: 'ignore' });
  });

  test('gets track id from active track event', () => {
    expect(getTrackIdFromActiveTrackEvent({ track: { id: 's1' } })).toBe('s1');
    expect(getTrackIdFromActiveTrackEvent({ trackId: 123 })).toBe('123');
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

  test('syncs numeric native track ids after normalization', () => {
    const setCurrentSong = jest.fn();
    const persistCurrentSongId = jest.fn(async () => undefined);

    syncCurrentSongFromActiveTrackEvent({
      event: { track: { id: 123 } },
      songSources: [[numericSong]],
      setCurrentSong,
      persistCurrentSongId,
    });

    expect(setCurrentSong).toHaveBeenCalledWith(numericSong);
    expect(persistCurrentSongId).toHaveBeenCalledWith(numericSong);
  });

  test('clears stale current song for empty or unknown native track events', () => {
    const setCurrentSong = jest.fn();
    const persistCurrentSongId = jest.fn(async () => undefined);

    syncCurrentSongFromActiveTrackEvent({
      event: { track: null },
      songSources: [[librarySong]],
      setCurrentSong,
      persistCurrentSongId,
    });
    syncCurrentSongFromActiveTrackEvent({
      event: { track: { id: 'missing' } },
      songSources: [[librarySong]],
      setCurrentSong,
      persistCurrentSongId,
    });

    expect(setCurrentSong).toHaveBeenNthCalledWith(1, null);
    expect(setCurrentSong).toHaveBeenNthCalledWith(2, null);
    expect(persistCurrentSongId).toHaveBeenNthCalledWith(1, null);
    expect(persistCurrentSongId).toHaveBeenNthCalledWith(2, null);
  });

  test('ignores malformed events with no track information', () => {
    const setCurrentSong = jest.fn();
    const persistCurrentSongId = jest.fn(async () => undefined);

    syncCurrentSongFromActiveTrackEvent({
      event: {},
      songSources: [[librarySong]],
      setCurrentSong,
      persistCurrentSongId,
    });

    expect(setCurrentSong).not.toHaveBeenCalled();
    expect(persistCurrentSongId).not.toHaveBeenCalled();
  });
});
