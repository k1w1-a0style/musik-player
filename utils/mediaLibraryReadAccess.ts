import type * as MediaLibrary from 'expo-media-library/legacy';
import { throwIfAborted } from './withTimeout';

export interface AudioReadPermission {
  status: string;
  canAskAgain?: boolean;
}
export type AudioPermissionQuery = (writeOnly?: boolean, granularPermissions?: MediaLibrary.GranularPermission[]) => Promise<AudioReadPermission>;

export class MediaLibraryReadAccessError extends Error {
  constructor() {
    super('Musikzugriff fehlt. Erlaube den Zugriff auf Musik in den App-Einstellungen oder wähle einen Musikordner aus. Vorhandene Titel bleiben erhalten.');
    this.name = 'MediaLibraryReadAccessError';
  }
}

export const isMediaLibraryReadAccessError = (error: unknown): boolean =>
  error instanceof MediaLibraryReadAccessError
  || (error instanceof Error && (/Missing MEDIA_LIBRARY permissions\.?/i.test(error.message)
    || (/ExpoMediaLibrary\.getAssetsAsync/.test(error.message)
      && /Permission Denial|SecurityException|EACCES|READ_MEDIA_AUDIO|READ_EXTERNAL_STORAGE/i.test(error.message))));

export const describeAudioReadFailure = (error: unknown, verified: boolean | undefined, fallback: string): string =>
  verified && isMediaLibraryReadAccessError(error)
    ? 'Musikzugriff bestätigt; die Android-Medienabfrage ist fehlgeschlagen. Freigegebene Ordner bleiben unabhängig verfügbar.'
    : fallback;

export const ensureAudioReadAccess = async (
  request: AudioPermissionQuery,
  get: AudioPermissionQuery,
  signal: AbortSignal,
  allowRequest = true,
): Promise<void> => {
  throwIfAborted(signal);
  const current = await get(false, ['audio']);
  throwIfAborted(signal);
  if (current.status === 'granted') return;
  if (!allowRequest || current.canAskAgain === false) throw new MediaLibraryReadAccessError();
  const requested = await request(false, ['audio']);
  throwIfAborted(signal);
  if (requested.status !== 'granted') throw new MediaLibraryReadAccessError();
  // The request result is not a cached grant. Check the actual read state again.
  const verified = await get(false, ['audio']);
  throwIfAborted(signal);
  if (verified.status !== 'granted') throw new MediaLibraryReadAccessError();
};
