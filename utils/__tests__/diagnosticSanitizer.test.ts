import { sanitizeDiagnosticArgs, sanitizeDiagnosticText, sanitizeDiagnosticValue } from '../diagnosticSanitizer';

describe('diagnostic sanitizer', () => {
  test.each([
    'content://com.android.providers.media/documents/audio%3A42',
    'file:///storage/emulated/0/Music/private-song.mp3',
    '/storage/emulated/0/Music/private-song.mp3',
    'C:\\Users\\Kiwi\\Music\\private-song.mp3',
    'https://example.invalid/download/private-song.mp3?token=TOPSECRET',
    'private-song.mp3',
    'Bearer eyJhbGciOiJIUzI1NiJ9.secret.signature',
    'api_key=SUPERSECRET123',
  ])('removes sensitive path/URI/file text: %s', (value) => {
    const safe = sanitizeDiagnosticText(`failed at ${value}`);
    expect(safe).not.toContain(value);
    expect(safe).not.toContain('private-song.mp3');
    expect(safe).not.toContain('TOPSECRET');
    expect(safe).not.toContain('SUPERSECRET123');
    expect(safe).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  test('redacts sensitive object fields and error stacks while preserving useful counters', () => {
    const error = new Error('Could not read file:///storage/emulated/0/Music/private.mp3');
    error.stack = 'SECRET_STACK /storage/emulated/0/Music/private.mp3';
    const safe = sanitizeDiagnosticValue({
      uri: 'content://provider/private',
      path: '/storage/emulated/0/Music/private.mp3',
      title: 'Private title',
      token: 'TOPSECRET',
      processed: 7,
      error,
    });
    const serialized = JSON.stringify(safe);
    expect(serialized).toContain('"processed":7');
    expect(serialized).not.toContain('content://');
    expect(serialized).not.toContain('/storage/');
    expect(serialized).not.toContain('Private title');
    expect(serialized).not.toContain('TOPSECRET');
    expect(serialized).not.toContain('SECRET_STACK');
  });

  test('sanitizes complete console argument lists', () => {
    const safe = sanitizeDiagnosticArgs(['content://provider/private', { title: 'Secret title', count: 2 }]);
    expect(safe).toEqual(['<redacted-uri>', { title: '<redacted>', count: 2 }]);
  });

  test('handles circular diagnostic values without throwing', () => {
    const value: Record<string, unknown> = { count: 1 };
    value.self = value;
    expect(sanitizeDiagnosticValue(value)).toEqual({ count: 1, self: '<circular>' });
  });
});
