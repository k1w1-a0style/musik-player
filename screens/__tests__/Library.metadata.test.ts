import { deriveMimeType } from '../Library';

describe('Library metadata helpers', () => {
  test('derives mime type from extension map', () => {
    expect(deriveMimeType(undefined, 'mp3')).toBe('audio/mpeg');
    expect(deriveMimeType(undefined, 'm4a')).toBe('audio/mp4');
    expect(deriveMimeType(undefined, 'mp4')).toBe('audio/mp4');
    expect(deriveMimeType(undefined, 'flac')).toBe('audio/flac');
    expect(deriveMimeType(undefined, 'unknown')).toBeUndefined();
  });

  test('ignores media class strings like audio', () => {
    expect(deriveMimeType('audio', 'mp3')).toBe('audio/mpeg');
  });

  test('keeps real mime type from asset when valid', () => {
    expect(deriveMimeType('audio/ogg', 'mp3')).toBe('audio/ogg');
  });
});
