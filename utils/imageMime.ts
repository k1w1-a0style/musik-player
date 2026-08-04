export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

type ImageSignature = {
  mime: SupportedImageMime;
  minimumLength: number;
  bytes: ReadonlyArray<readonly [offset: number, value: number]>;
};

const IMAGE_SIGNATURES: readonly ImageSignature[] = [
  {
    mime: 'image/jpeg',
    minimumLength: 3,
    bytes: [[0, 0xff], [1, 0xd8], [2, 0xff]],
  },
  {
    mime: 'image/png',
    minimumLength: 8,
    bytes: [
      [0, 0x89], [1, 0x50], [2, 0x4e], [3, 0x47],
      [4, 0x0d], [5, 0x0a], [6, 0x1a], [7, 0x0a],
    ],
  },
  {
    mime: 'image/webp',
    minimumLength: 12,
    bytes: [
      [0, 0x52], [1, 0x49], [2, 0x46], [3, 0x46],
      [8, 0x57], [9, 0x45], [10, 0x42], [11, 0x50],
    ],
  },
];

const matchesImageSignature = (bytes: Uint8Array, signature: ImageSignature): boolean =>
  bytes.length >= signature.minimumLength
  && signature.bytes.every(([offset, value]) => bytes[offset] === value);

export const detectImageMimeFromBytes = (bytes: Uint8Array): SupportedImageMime | undefined =>
  IMAGE_SIGNATURES.find(signature => matchesImageSignature(bytes, signature))?.mime;

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