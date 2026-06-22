import {
  buildJsFallbackPalette,
  hashStringFnv1a,
  mergeNativeAndFallbackPalette,
  pickReadableForeground,
} from '../jsPaletteFallback';
import type { Song } from '../../types/Song';

const song = (overrides: Partial<Song> = {}): Song => ({
  id: 's1',
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  ...overrides,
});

describe('hashStringFnv1a', () => {
  test('is deterministic and differs between inputs', () => {
    expect(hashStringFnv1a('a')).toBe(hashStringFnv1a('a'));
    expect(hashStringFnv1a('a')).not.toBe(hashStringFnv1a('b'));
  });
});

describe('buildJsFallbackPalette', () => {
  test('returns the seven palette fields with valid 6-digit hex', () => {
    const palette = buildJsFallbackPalette(song());
    for (const field of ['dominant', 'vibrant', 'lightVibrant', 'darkVibrant', 'muted', 'lightMuted', 'darkMuted'] as const) {
      expect(palette[field]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  test('is deterministic per song identity', () => {
    const a = buildJsFallbackPalette(song({ id: 'songX', artist: 'A', album: 'B', title: 'T' }));
    const b = buildJsFallbackPalette(song({ id: 'songX', artist: 'A', album: 'B', title: 'T' }));
    expect(a).toEqual(b);
  });

  test('different songs produce different accents', () => {
    const a = buildJsFallbackPalette(song({ id: 'a', artist: 'A' }));
    const b = buildJsFallbackPalette(song({ id: 'b', artist: 'B' }));
    expect(a.vibrant).not.toBe(b.vibrant);
  });

  test('null song returns a stable fallback palette', () => {
    expect(buildJsFallbackPalette(null).vibrant).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('mergeNativeAndFallbackPalette', () => {
  test('native fields win, fallback fills gaps', () => {
    const merged = mergeNativeAndFallbackPalette({ dominant: '#abcdef' }, song());
    expect(merged.dominant).toBe('#abcdef');
    expect(merged.vibrant).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('null native palette falls back fully', () => {
    const merged = mergeNativeAndFallbackPalette(null, song());
    expect(merged.dominant).toMatch(/^#[0-9a-f]{6}$/i);
    expect(merged.vibrant).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('pickReadableForeground', () => {
  test('returns dark text on light backgrounds and light text on dark backgrounds', () => {
    expect(pickReadableForeground('#FFFFFF')).toBe('#0A0B0C');
    expect(pickReadableForeground('#000000')).toBe('#FFFFFF');
    expect(pickReadableForeground('#2A3A55')).toBe('#FFFFFF');
  });

  test('tolerates malformed hex by returning the light default', () => {
    expect(pickReadableForeground('not-a-hex')).toBe('#FFFFFF');
  });
});
