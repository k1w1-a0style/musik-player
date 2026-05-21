export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const detectImageMimeFromBytes = (bytes: Uint8Array): SupportedImageMime | undefined => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  if (
    bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return undefined;
};

const stripMimeParameters = (value: string): string => value.split(';')[0]?.trim().toLowerCase() ?? '';

export const normalizeImageMime = (value?: string): SupportedImageMime | undefined => {
  if (!value) return undefined;
  const normalized = stripMimeParameters(value);
  if (normalized === 'image/jpeg' || normalized === 'image/jpg' || normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized === 'image/png' || normalized === 'png') return 'image/png';
  if (normalized === 'image/webp' || normalized === 'webp') return 'image/webp';
  return undefined;
};

export const imageExtensionFromMime = (mime: SupportedImageMime): 'jpg' | 'png' | 'webp' => {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
};