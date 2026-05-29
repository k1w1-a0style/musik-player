import { createPlaylistId } from '../playlistIds';

type TestCrypto = { randomUUID?: () => string };

const setGlobalCrypto = (value: TestCrypto | undefined): void => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value,
  });
};

describe('playlistIds', () => {
  const originalCrypto = (globalThis as typeof globalThis & { crypto?: TestCrypto }).crypto;

  afterEach(() => {
    setGlobalCrypto(originalCrypto);
    jest.restoreAllMocks();
  });

  test('uses crypto.randomUUID when available', () => {
    setGlobalCrypto({ randomUUID: jest.fn(() => 'uuid-1') });

    expect(createPlaylistId(123)).toBe('pl-uuid-1');
  });

  test('falls back to timestamp plus random suffix without crypto.randomUUID', () => {
    setGlobalCrypto(undefined);
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

    expect(createPlaylistId(123)).toBe('pl-123-4fzzzxjy');
  });
});
