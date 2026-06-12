import { buildEditableCoverFromPickerAsset, MAX_TAG_COVER_BYTES } from '../tagCoverPicker';

const jpgBytes = [0xff, 0xd8, 0xff, 0x00];
const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const webpBytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const jpgBase64 = Buffer.from(jpgBytes).toString('base64');
const pngBase64 = Buffer.from(pngBytes).toString('base64');
const webpBase64 = Buffer.from(webpBytes).toString('base64');
const toBase64 = (value: string): string => Buffer.from(value, 'utf8').toString('base64');

test('builds jpeg cover from mime type', () => {
  const result = buildEditableCoverFromPickerAsset({
    base64: jpgBase64,
    mimeType: 'image/jpeg',
    uri: 'file:///cover.jpg',
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.cover.mimeType).toBe('image/jpeg');
  expect(result.cover.sizeBytes).toBe(jpgBytes.length);
  expect(Array.from(result.cover.data)).toEqual(jpgBytes);
});

test('accepts detected jpeg when mime type is missing', () => {
  const result = buildEditableCoverFromPickerAsset({
    base64: jpgBase64,
    uri: 'file:///cover',
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.cover.mimeType).toBe('image/jpeg');
});

test('accepts png cover', () => {
  const result = buildEditableCoverFromPickerAsset({
    base64: pngBase64,
    mimeType: 'image/png',
    uri: 'file:///cover.png',
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.cover.mimeType).toBe('image/png');
  expect(result.cover.sizeBytes).toBe(pngBytes.length);
  expect(Array.from(result.cover.data)).toEqual(pngBytes);
});

test('rejects missing URI', () => {
  expect(buildEditableCoverFromPickerAsset({ base64: pngBase64, mimeType: 'image/png' })).toEqual({
    ok: false,
    reason: 'missingUri',
  });
});

test('rejects whitespace URI', () => {
  expect(buildEditableCoverFromPickerAsset({ base64: pngBase64, mimeType: 'image/png', uri: '   ' })).toEqual({
    ok: false,
    reason: 'missingUri',
  });
});

test('rejects missing base64', () => {
  expect(buildEditableCoverFromPickerAsset({ mimeType: 'image/png', uri: 'file:///cover.png' })).toEqual({
    ok: false,
    reason: 'missingBase64',
  });
});

test('rejects detected image types that cannot be written as editable covers', () => {
  expect(buildEditableCoverFromPickerAsset({ base64: webpBase64, mimeType: 'image/webp', uri: 'file:///cover.webp' })).toEqual({
    ok: false,
    reason: 'unsupportedMime',
  });
});

test('rejects oversized cover', () => {
  const huge = Buffer.alloc(MAX_TAG_COVER_BYTES + 1).toString('base64');
  expect(buildEditableCoverFromPickerAsset({ base64: huge, mimeType: 'image/png', uri: 'file:///cover.png' })).toEqual({
    ok: false,
    reason: 'tooLarge',
  });
});


test('rejects invalid base64 without saving corrupted cover data', () => {
  expect(buildEditableCoverFromPickerAsset({ base64: 'not-valid', mimeType: 'image/png', uri: 'file:///cover.png' })).toEqual({
    ok: false,
    reason: 'invalidBase64',
  });
});

test('uses detected jpeg mime when declared mime says png', () => {
  const result = buildEditableCoverFromPickerAsset({
    base64: jpgBase64,
    mimeType: 'image/png',
    uri: 'file:///cover.png',
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.cover.mimeType).toBe('image/jpeg');
  expect(Array.from(result.cover.data)).toEqual(jpgBytes);
});

test('uses detected mime when extension fallback differs from encoded bytes', () => {
  const pngResult = buildEditableCoverFromPickerAsset({
    base64: pngBase64,
    uri: 'file:///cover.jpg',
  });
  expect(pngResult.ok).toBe(true);
  if (pngResult.ok) expect(pngResult.cover.mimeType).toBe('image/png');

  const jpgResult = buildEditableCoverFromPickerAsset({
    base64: jpgBase64,
    uri: 'file:///cover.png',
  });
  expect(jpgResult.ok).toBe(true);
  if (jpgResult.ok) expect(jpgResult.cover.mimeType).toBe('image/jpeg');
});

test('rejects cover when bytes are not a supported image signature', () => {
  expect(buildEditableCoverFromPickerAsset({
    base64: toBase64('not an image'),
    mimeType: 'image/jpeg',
    uri: 'file:///cover.jpg',
  })).toEqual({
    ok: false,
    reason: 'invalidImageBytes',
  });
});

test('decodes picked cover without global atob', () => {
  const originalAtob = globalThis.atob;
  Object.defineProperty(globalThis, 'atob', { configurable: true, writable: true, value: undefined });
  try {
    const result = buildEditableCoverFromPickerAsset({ base64: pngBase64, mimeType: 'image/png', uri: 'file:///cover.png' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.from(result.cover.data)).toEqual(pngBytes);
  } finally {
    Object.defineProperty(globalThis, 'atob', { configurable: true, writable: true, value: originalAtob });
  }
});
