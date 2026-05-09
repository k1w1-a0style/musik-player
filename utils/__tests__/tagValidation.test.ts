import { normalizeEditableTags, validateCoverPayload, validateEditableTags, validateYear } from '../tagValidation';

describe('tagValidation', () => {
  test('normalization trims and empties to undefined', () => {
    expect(normalizeEditableTags({ title: '  X ', artist: '   ' })).toEqual({
      title: 'X', artist: undefined, album: undefined, year: undefined, genre: undefined, trackNumber: undefined, discNumber: undefined, comment: undefined,
    });
  });

  test('year validation', () => {
    expect(validateYear('1899')).toBe(true);
    expect(validateYear('20A0')).toBe(false);
  });

  test('invalid year rejected by validateEditableTags', () => {
    expect(validateEditableTags({ year: '99' }).valid).toBe(false);
    expect(validateEditableTags({ year: '2024' }).valid).toBe(true);
  });

  test('cover magic bytes are checked', () => {
    expect(validateCoverPayload({ mimeType: 'image/jpeg', data: new Uint8Array([0xff, 0xd8, 0xff]) })).toBe(true);
    expect(validateCoverPayload({ mimeType: 'image/png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) })).toBe(true);
    expect(validateCoverPayload({ mimeType: 'image/jpeg', data: new Uint8Array([0x00, 0x11]) })).toBe(false);
  });
});
