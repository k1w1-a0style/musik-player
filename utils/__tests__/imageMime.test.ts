import {
  detectImageMimeFromBytes,
  imageExtensionFromMime,
  normalizeImageMime,
} from '../imageMime';

describe('imageMime helpers', () => {
  test('detects supported image mime types from magic bytes', () => {
    expect(detectImageMimeFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(detectImageMimeFromBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectImageMimeFromBytes(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
  });

  test('returns undefined for unsupported or truncated image bytes', () => {
    expect(detectImageMimeFromBytes(new Uint8Array([0xff, 0xd8]))).toBeUndefined();
    expect(detectImageMimeFromBytes(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeUndefined();
    expect(detectImageMimeFromBytes(new Uint8Array([]))).toBeUndefined();
  });

  test('normalizes exact supported mime values and simple extensions', () => {
    expect(normalizeImageMime('image/jpeg')).toBe('image/jpeg');
    expect(normalizeImageMime('image/jpg')).toBe('image/jpeg');
    expect(normalizeImageMime(' JPEG ')).toBe('image/jpeg');
    expect(normalizeImageMime('image/png; charset=binary')).toBe('image/png');
    expect(normalizeImageMime('webp')).toBe('image/webp');
  });

  test('rejects misleading mime strings instead of substring matching', () => {
    expect(normalizeImageMime('application/not-a-jpeg')).toBeUndefined();
    expect(normalizeImageMime('text/png-metadata')).toBeUndefined();
    expect(normalizeImageMime('image/svg+xml')).toBeUndefined();
    expect(normalizeImageMime('image/jpeg2000')).toBeUndefined();
    expect(normalizeImageMime(undefined)).toBeUndefined();
  });

  test('maps supported mime types to file extensions', () => {
    expect(imageExtensionFromMime('image/jpeg')).toBe('jpg');
    expect(imageExtensionFromMime('image/png')).toBe('png');
    expect(imageExtensionFromMime('image/webp')).toBe('webp');
  });
});
