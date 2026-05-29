import { getSongArtworkUri } from '../songArtwork';

describe('songArtwork', () => {
  test('returns coverInfo uri before cover when present', () => {
    expect(getSongArtworkUri({
      cover: 'file:///cover.jpg',
      coverInfo: { uri: 'file:///cover-info.jpg' },
    })).toBe('file:///cover-info.jpg');
  });

  test('trims artwork uris before returning them', () => {
    expect(getSongArtworkUri({ coverInfo: { uri: ' file:///cover-info.jpg ' } })).toBe('file:///cover-info.jpg');
    expect(getSongArtworkUri({ cover: ' file:///cover.jpg ' })).toBe('file:///cover.jpg');
  });

  test('falls back to cover when coverInfo uri is blank', () => {
    expect(getSongArtworkUri({
      cover: 'file:///cover.jpg',
      coverInfo: { uri: '   ' },
    })).toBe('file:///cover.jpg');
  });

  test('returns undefined for missing or blank artwork', () => {
    expect(getSongArtworkUri(undefined)).toBeUndefined();
    expect(getSongArtworkUri(null)).toBeUndefined();
    expect(getSongArtworkUri({ cover: '   ', coverInfo: { uri: '' } })).toBeUndefined();
  });
});
