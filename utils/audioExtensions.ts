export const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'mp4', 'aac', 'flac', 'wav', 'ogg', 'opus', 'webm']);

// Extensions that may arrive through trusted audio providers even when they are not
// broad extension-only import candidates. Keep them strippable for title fallbacks.
export const TITLE_FALLBACK_AUDIO_EXTENSIONS = new Set([...AUDIO_EXTENSIONS, 'm4b']);

export const KNOWN_NON_AUDIO_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'txt',
  'nfo',
  'cue',
  'lrc',
  'm3u',
  'm3u8',
  'pls',
  'pdf',
  'json',
]);

export const EXTENSION_MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  webm: 'audio/webm',
};
