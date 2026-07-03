import {
  displayFilename,
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

  test('URL-encoded filenames are decoded and stripped for title fallback', () => {
    expect(displayNameFromFilename('My%20Song%20%28Live%29.m4a')).toBe('My Song (Live)');
  });

  test('display filename decodes but keeps extension', () => {
    expect(displayFilename('My%20Song%20%28Live%29.m4a')).toBe('My Song (Live).m4a');
  });

  test('content URI fallback handles encoded path separators by taking the decoded basename', () => {
    expect(displayNameFromFilename(undefined, 'content://tree/primary%3AMusic%2FArtist%20-%20Title.m4a')).toBe('Artist - Title');
  });

  test('supported audio extensions are stripped consistently', () => {
    for (const extension of ['mp3', 'm4a', 'mp4', 'aac', 'flac', 'wav', 'ogg', 'opus', 'webm']) {
      expect(displayNameFromFilename(`Track Name.${extension}`)).toBe('Track Name');
    }
  });

  test('webm artist-title filename fallback matches other audio files', () => {
    expect(parseFilename('Artist - Song.webm')).toEqual({ artist: 'Artist', title: 'Song' });
    expect(parseFilename('Song.webm')).toEqual({ title: 'Song' });
  });

  test('unknown-like metadata values do not block better fallbacks', () => {
    expect(normalizeMetadataText('unknown')).toBeUndefined();
    expect(normalizeMetadataText('undefined')).toBeUndefined();
    expect(normalizeMetadataText('null')).toBeUndefined();
    expect(normalizeMetadataText('<unknown>')).toBeUndefined();
    expect(resolveDisplayTitle('unknown', 'Artist - Title.m4a')).toBe('Artist - Title');
  });

  test('filename parser decodes M4A artist-title fallback', () => {
    expect(parseFilename('Artist%20Name%20-%20Titel.m4a')).toEqual({ artist: 'Artist Name', title: 'Titel' });
  });
});
