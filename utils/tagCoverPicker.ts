import type { EditableCover } from '../types/TagEdit';
import { Base64DecodeError, decodeBase64ToBytes } from './base64';
import { detectImageMimeFromBytes } from './imageMime';

export const MAX_TAG_COVER_BYTES = 5 * 1024 * 1024;

export type PickedTagCover = EditableCover & {
  uri?: string;
  sizeBytes: number;
};

export type CoverPickFailureReason =
  | 'missingUri'
  | 'missingBase64'
  | 'invalidBase64'
  | 'unsupportedMime'
  | 'tooLarge'
  | 'invalidImageBytes';

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

export const buildEditableCoverFromPickerAsset = (asset: {
  base64?: string | null;
  mimeType?: string | null;
  uri?: string;
}): CoverPickResult => {
  const uri = asset.uri?.trim();
  if (!uri || uri !== asset.uri) return { ok: false, reason: 'missingUri' };
  if (!asset.base64?.trim()) return { ok: false, reason: 'missingBase64' };
  const mimeType = normalizeMimeType(asset.mimeType, uri);
  if (!mimeType) return { ok: false, reason: 'unsupportedMime' };
  let data: Uint8Array;
  try {
    data = decodeBase64ToBytes(asset.base64);
  } catch (error) {
    if (error instanceof Base64DecodeError) return { ok: false, reason: 'invalidBase64' };
    throw error;
  }
  if (data.byteLength === 0) return { ok: false, reason: 'missingBase64' };
  if (data.byteLength > MAX_TAG_COVER_BYTES) return { ok: false, reason: 'tooLarge' };
  const detectedMime = detectImageMimeFromBytes(data);
  if (detectedMime !== mimeType) return { ok: false, reason: 'invalidImageBytes' };
  return { ok: true, cover: { data, mimeType, uri, sizeBytes: data.byteLength } };
};
