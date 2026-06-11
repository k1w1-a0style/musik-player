import { buildEditableCoverFromPickerAsset, MAX_TAG_COVER_BYTES } from '../tagCoverPicker';

const toBase64 = (value: string): string => Buffer.from(value, 'utf8').toString('base64');

test('builds jpeg cover from mime type', () => {
  const result = buildEditableCoverFromPickerAsset({
    base64: toBase64('cover'),
    mimeType: 'image/jpeg',
    uri: 'file:///cover.jpg',
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.cover.mimeType).toBe('image/jpeg');
  expect(result.cover.sizeBytes).toBe(5);
  expect(Array.from(result.cover.data)).toEqual(Array.from(Buffer.from('cover')));
});

test('accepts jpg extension fallback when mime type is missing', () => {
  const result = buildEditableCoverFromPickerAsset({
    base64: toBase64('cover'),
    uri: 'file:///cover.jpeg?cache=1',
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.cover.mimeType).toBe('image/jpeg');
});

test('accepts png cover', () => {
  const result = buildEditableCoverFromPickerAsset({
    base64: toBase64('png'),
    mimeType: 'image/png',
    uri: 'file:///cover.png',
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.cover.mimeType).toBe('image/png');
});

test('rejects missing URI', () => {
  expect(buildEditableCoverFromPickerAsset({ base64: toBase64('png'), mimeType: 'image/png' })).toEqual({
    ok: false,
    reason: 'missingUri',
  });
});

test('rejects whitespace URI', () => {
  expect(buildEditableCoverFromPickerAsset({ base64: toBase64('png'), mimeType: 'image/png', uri: '   ' })).toEqual({
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

test('rejects unsupported mime type', () => {
  expect(buildEditableCoverFromPickerAsset({ base64: toBase64('gif'), mimeType: 'image/gif', uri: 'file:///cover.gif' })).toEqual({
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

test('decodes picked cover without global atob', () => {
  const originalAtob = globalThis.atob;
  Object.defineProperty(globalThis, 'atob', { configurable: true, writable: true, value: undefined });
  try {
    const result = buildEditableCoverFromPickerAsset({ base64: 'cG5n', mimeType: 'image/png', uri: 'file:///cover.png' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.from(result.cover.data)).toEqual([112, 110, 103]);
  } finally {
    Object.defineProperty(globalThis, 'atob', { configurable: true, writable: true, value: originalAtob });
  }
});
