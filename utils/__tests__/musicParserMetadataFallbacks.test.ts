import {
  displayNameFromFilename,
  normalizeMetadataText,
  parseFilename,
  resolveDisplayArtist,
  resolveDisplayTitle,
} from '../musicParser';

describe('metadata fallback helpers', () => {
  test('empty title falls back to filename without extension', () => {
    expect(resolveDisplayTitle('', 'Artist - Example Song.mp3')).toBe('Artist - Example Song');
  });

  test('whitespace-only artist falls back to project unknown label', () => {
    expect(resolveDisplayArtist('   ')).toBe('Unbekannt');
  });

  test('URL-encoded filenames are decoded and stripped', () => {
    expect(displayNameFromFilename('My%20Song%20%28Live%29.m4a')).toBe('My Song (Live)');
  });

  test('mp3 and m4a filenames behave consistently', () => {
    expect(displayNameFromFilename('Track Name.mp3')).toBe('Track Name');
    expect(displayNameFromFilename('Track Name.m4a')).toBe('Track Name');
  });

  test('unknown-like metadata values are not accepted as display values', () => {
    expect(normalizeMetadataText('unknown')).toBeUndefined();
    expect(normalizeMetadataText('undefined')).toBeUndefined();
    expect(normalizeMetadataText('null')).toBeUndefined();
    expect(resolveDisplayTitle('unknown', 'Readable.mp4')).toBe('Readable');
  });

  test('filename parser decodes M4A artist-title fallback', () => {
    expect(parseFilename('Artist%20Name%20-%20Titel.m4a')).toEqual({ artist: 'Artist Name', title: 'Titel' });
  });
});
