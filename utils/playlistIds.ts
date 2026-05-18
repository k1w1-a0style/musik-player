type CryptoWithRandomUUID = {
  randomUUID?: () => string;
};

const PLAYLIST_ID_PREFIX = 'pl';

const getRandomUuid = (): string | null => {
  const cryptoObject = (globalThis as typeof globalThis & { crypto?: CryptoWithRandomUUID })
    .crypto;
  return typeof cryptoObject?.randomUUID === 'function' ? cryptoObject.randomUUID() : null;
};

const getFallbackId = (now: number): string => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${now}-${randomPart}`;
};

export const createPlaylistId = (now = Date.now()): string => {
  const uuid = getRandomUuid();
  return `${PLAYLIST_ID_PREFIX}-${uuid ?? getFallbackId(now)}`;
};
