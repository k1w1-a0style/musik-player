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
    expect(resolveDisplayTitle('', 'Artist - Example Song.mp3')).toBe('Example Song');
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

  test('supported and trusted audio fallback extensions are stripped consistently', () => {
    for (const extension of ['mp3', 'm4a', 'mp4', 'aac', 'flac', 'wav', 'ogg', 'opus', 'webm', 'm4b']) {
      expect(displayNameFromFilename(`Track Name.${extension}`)).toBe('Track Name');
    }
  });

  test('known non-audio extensions are not stripped as audio title fallbacks', () => {
    for (const extension of ['jpg', 'png', 'pdf', 'json', 'm3u']) {
      expect(displayNameFromFilename(`Track Name.${extension}`)).toBe(`Track Name.${extension}`);
    }
  });

  test('webm and m4b artist-title filename fallback matches other audio files', () => {
    expect(parseFilename('Artist - Song.webm')).toEqual({ artist: 'Artist', title: 'Song' });
    expect(parseFilename('Song.webm')).toEqual({ title: 'Song' });
    expect(parseFilename('Artist - Book.m4b')).toEqual({ artist: 'Artist', title: 'Book' });
    expect(parseFilename('Book.m4b')).toEqual({ title: 'Book' });
  });

  test.each([
    ['unknown - Real Song.m4a', { title: 'Real Song' }],
    ['null - Real Song.mp3', { title: 'Real Song' }],
    ['undefined - Real Song.webm', { title: 'Real Song' }],
    ['<unknown> - Real Song.m4b', { title: 'Real Song' }],
    ['Real Artist - Real Song.m4a', { artist: 'Real Artist', title: 'Real Song' }],
    ['Real%20Artist%20–%20Real%20Song.m4a', { artist: 'Real Artist', title: 'Real Song' }],
    ['Artist - Album - Song.m4a', { artist: 'Artist', title: 'Album - Song' }],
  ])('drops placeholder filename segments in %s', (filename, expected) => {
    expect(parseFilename(filename)).toEqual(expected);
  });

  test('placeholder title segments do not become visible title fallbacks', () => {
    expect(parseFilename('Real Artist - unknown.m4a')).toEqual({ artist: 'Real Artist', title: 'Unbekannter Titel' });
    expect(parseFilename('unknown.m4a')).toEqual({ title: 'Unbekannter Titel' });
    expect(resolveDisplayTitle('unknown', 'unknown - Real Song.m4a')).toBe('Real Song');
  });

  test('unknown-like metadata values do not block better fallbacks', () => {
    expect(normalizeMetadataText('unknown')).toBeUndefined();
    expect(normalizeMetadataText('undefined')).toBeUndefined();
    expect(normalizeMetadataText('null')).toBeUndefined();
    expect(normalizeMetadataText('<unknown>')).toBeUndefined();
    expect(resolveDisplayTitle('unknown', 'Artist - Title.m4a')).toBe('Title');
  });

  test('filename parser decodes M4A artist-title fallback', () => {
    expect(parseFilename('Artist%20Name%20-%20Titel.m4a')).toEqual({ artist: 'Artist Name', title: 'Titel' });
  });
});
