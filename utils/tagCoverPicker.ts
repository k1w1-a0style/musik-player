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

const isEditableCoverMime = (mimeType: string | undefined): mimeType is EditableCover['mimeType'] =>
  mimeType === 'image/jpeg' || mimeType === 'image/png';

export const buildEditableCoverFromPickerAsset = (asset: {
  base64?: string | null;
  mimeType?: string | null;
  uri?: string;
}): CoverPickResult => {
  const uri = asset.uri?.trim();
  if (!uri || uri !== asset.uri) return { ok: false, reason: 'missingUri' };
  if (!asset.base64?.trim()) return { ok: false, reason: 'missingBase64' };
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
  if (!detectedMime) return { ok: false, reason: 'invalidImageBytes' };
  if (!isEditableCoverMime(detectedMime)) return { ok: false, reason: 'unsupportedMime' };
  return { ok: true, cover: { data, mimeType: detectedMime, uri, sizeBytes: data.byteLength } };
};
