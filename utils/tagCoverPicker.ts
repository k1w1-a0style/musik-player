import type { EditableCover } from '../types/TagEdit';

export const MAX_TAG_COVER_BYTES = 5 * 1024 * 1024;

export type PickedTagCover = EditableCover & {
  uri?: string;
  sizeBytes: number;
};

export type CoverPickFailureReason = 'missingBase64' | 'unsupportedMime' | 'tooLarge';

export type CoverPickResult =
  | { ok: true; cover: PickedTagCover }
  | { ok: false; reason: CoverPickFailureReason };

const MIME_BY_EXTENSION: Record<string, EditableCover['mimeType']> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const normalizeMimeType = (mimeType?: string | null, uri?: string): EditableCover['mimeType'] | null => {
  const normalized = mimeType?.toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'image/jpeg';
  if (normalized === 'image/png') return 'image/png';
  const extension = uri?.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase();
  return extension ? MIME_BY_EXTENSION[extension] ?? null : null;
};

export const base64ToBytes = (base64: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(base64, 'base64'));
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const buildEditableCoverFromPickerAsset = (asset: {
  base64?: string | null;
  mimeType?: string | null;
  uri?: string;
}): CoverPickResult => {
  if (!asset.base64) return { ok: false, reason: 'missingBase64' };
  const mimeType = normalizeMimeType(asset.mimeType, asset.uri);
  if (!mimeType) return { ok: false, reason: 'unsupportedMime' };
  const data = base64ToBytes(asset.base64);
  if (data.byteLength > MAX_TAG_COVER_BYTES) return { ok: false, reason: 'tooLarge' };
  return { ok: true, cover: { data, mimeType, uri: asset.uri, sizeBytes: data.byteLength } };
};
