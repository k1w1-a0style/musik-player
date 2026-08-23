import { parseFilename, formatTime } from '../musicParser';

describe('musicParser', () => {
  describe('parseFilename', () => {
    test('artist - title format with dash', () => {
      expect(parseFilename('Daft Punk - Get Lucky.mp3')).toEqual({
        artist: 'Daft Punk',
        title: 'Get Lucky',
      });
    });

    test('artist – title with en-dash', () => {
      expect(parseFilename('Sade – Smooth Operator.flac')).toEqual({
        artist: 'Sade',
        title: 'Smooth Operator',
      });
    });

    test('multiple separators keep all but the first as title', () => {
      expect(parseFilename('Pink Floyd - Wish You Were Here - Live.mp3')).toEqual({
        artist: 'Pink Floyd',
        title: 'Wish You Were Here - Live',
      });
    });

    test('falls back to title-only when no separator', () => {
      expect(parseFilename('Untitled.mp3')).toEqual({ title: 'Untitled' });
    });

    test('strips multiple extensions correctly (last only)', () => {
      expect(parseFilename('Track.cool.song.opus')).toEqual({
        title: 'Track.cool.song',
      });
    });
  });

  describe('formatTime', () => {
    test('formats common values', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(1000)).toBe('0:01');
      expect(formatTime(65000)).toBe('1:05');
      expect(formatTime(3661000)).toBe('1:01:01');
    });

    test('rounds down', () => {
      expect(formatTime(1999)).toBe('0:01');
    });

    test('handles invalid input', () => {
      expect(formatTime(-100)).toBe('0:00');
      expect(formatTime(NaN)).toBe('0:00');
      expect(formatTime(Infinity)).toBe('0:00');
    });
  });
});
