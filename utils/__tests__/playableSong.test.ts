import type { Song } from '../../types/Song';
import { asPlayableSong, isPlayableSong, toPlayableSongs } from '../playableSong';

const baseSong: Song = { id: 's1', title: 'Song', artist: 'Artist' };

describe('playableSong', () => {
  test('song without uri is not playable', () => {
    expect(isPlayableSong(baseSong)).toBe(false);
  });

  test('song with empty or whitespace uri is not playable', () => {
    expect(isPlayableSong({ ...baseSong, uri: '' })).toBe(false);
    expect(isPlayableSong({ ...baseSong, uri: '   ' })).toBe(false);
  });

  test('song with valid uri is playable and usable as PlayableSong', () => {
    const song: Song = { ...baseSong, uri: ' file:///song.mp3 ' };
    const playable = asPlayableSong(song);
    expect(playable).toEqual({ ...baseSong, uri: 'file:///song.mp3' });
    expect(playable && isPlayableSong(playable)).toBe(true);
  });

  test('toPlayableSongs filters invalid songs', () => {
    const normalized = toPlayableSongs([
      baseSong,
      { ...baseSong, id: 's2', uri: '   ' },
      { ...baseSong, id: 's3', uri: 'file:///s3.mp3' },
    ]);
    expect(normalized.map(song => song.id)).toEqual(['s3']);
  });
});
