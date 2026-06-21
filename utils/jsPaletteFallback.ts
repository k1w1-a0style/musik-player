import type { PaletteResult } from 'expo-system-audio';
import type { Song } from '../types/Song';

/**
 * Deterministic JS-only palette fallback for Now-Playing colors.
 *
 * Native dominant-color extraction (`SystemAudio.extractPalette`) only works on
 * device. When it returns null (no cover, native unavailable, throw, …) we
 * derive a stable, pleasant accent set from the song identity so the background
 * is never the hard black/green brand color.
 *
 * Implementation:
 *   - FNV-1a hash over a stable identity string (id / artist+album+title)
 *   - HSL palette around a hue derived from the hash; bounded saturation/light
 *     so text contrast stays readable
 *   - Returns the exact `PaletteResult` shape so the rest of the UI keeps
 *     using vibrant/dominant/darkVibrant unchanged
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export const hashStringFnv1a = (value: string): number => {
  let hash = FNV_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = (hash * FNV_PRIME) >>> 0;
  }
  return hash;
};

const buildPaletteIdentity = (song: Song | null): string => {
  if (!song) return 'k1w1:no-song';
  const identityParts = [
    song.id ?? '',
    song.albumArtist ?? song.artist ?? '',
    song.album ?? '',
    song.title ?? '',
  ];
  const joined = identityParts.join('|').trim();
  return joined.length > 0 ? joined : 'k1w1:no-song';
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const hslToHex = (hue: number, saturation: number, lightness: number): string => {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((normalizedHue / 60) % 2 - 1));
  const m = l - c / 2;
  const segment = Math.floor(normalizedHue / 60) % 6;
  const channels = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][segment] ?? [c, x, 0];
  const toHex = (component: number): string => {
    const clamped = clamp(Math.round((component + m) * 255), 0, 255);
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(channels[0])}${toHex(channels[1])}${toHex(channels[2])}`;
};

/**
 * Build a JS-only palette deterministic in the song identity. The resulting
 * accent has a controlled saturation/lightness so text on the gradient stays
 * readable.
 */
export const buildJsFallbackPalette = (song: Song | null): PaletteResult => {
  const identity = buildPaletteIdentity(song);
  const hash = hashStringFnv1a(identity);
  const hue = hash % 360;
  // Keep saturation/lightness in a band that produces a calm, readable accent
  // rather than blown-out neons.
  const vibrant = hslToHex(hue, 0.62, 0.55);
  const lightVibrant = hslToHex(hue, 0.45, 0.72);
  const muted = hslToHex(hue, 0.30, 0.55);
  const dominant = hslToHex(hue, 0.55, 0.50);
  const darkVibrant = hslToHex(hue, 0.55, 0.22);
  const darkMuted = hslToHex(hue, 0.30, 0.18);
  const lightMuted = hslToHex(hue, 0.25, 0.78);
  return { dominant, vibrant, lightVibrant, darkVibrant, muted, lightMuted, darkMuted };
};

/**
 * Merge the native palette with the JS fallback, field-by-field. Native fields
 * win when defined, JS fills the gaps. This keeps the UI consistent when the
 * native module returns only some fields (e.g. dominant but no darkVibrant).
 */
export const mergeNativeAndFallbackPalette = (
  nativePalette: PaletteResult | null | undefined,
  song: Song | null,
): PaletteResult => {
  const fallback = buildJsFallbackPalette(song);
  if (!nativePalette) return fallback;
  return {
    dominant: nativePalette.dominant ?? fallback.dominant,
    vibrant: nativePalette.vibrant ?? fallback.vibrant,
    lightVibrant: nativePalette.lightVibrant ?? fallback.lightVibrant,
    darkVibrant: nativePalette.darkVibrant ?? fallback.darkVibrant,
    muted: nativePalette.muted ?? fallback.muted,
    lightMuted: nativePalette.lightMuted ?? fallback.lightMuted,
    darkMuted: nativePalette.darkMuted ?? fallback.darkMuted,
  };
};

/**
 * Returns a foreground color that has enough contrast against the supplied
 * background hex; used to keep titles/buttons readable when the cover palette
 * happens to be light.
 */
export const pickReadableForeground = (backgroundHex: string, lightColor = '#FFFFFF', darkColor = '#0A0B0C'): string => {
  const cleaned = backgroundHex.startsWith('#') ? backgroundHex.slice(1) : backgroundHex;
  if (cleaned.length !== 6) return lightColor;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return lightColor;
  // Perceived luminance (Rec. 601). Threshold 0.62 chosen empirically so dim
  // amber/blue accents still keep the white foreground.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? darkColor : lightColor;
};
