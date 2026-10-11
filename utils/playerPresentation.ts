export type LibraryDensity = 'standard' | 'compact';
export type WaveformAccent = 'cover' | 'neutral' | 'orange' | 'blue';
export interface PlayerPresentation {
  quiet: boolean;
  density: LibraryDensity;
  waveformAccent: WaveformAccent;
}
export const PLAYER_PRESENTATION_KEY = 'playerPresentationV3';
export const DEFAULT_PLAYER_PRESENTATION: Readonly<PlayerPresentation> = Object.freeze({
  quiet: false, density: 'standard', waveformAccent: 'cover',
});
export const normalizePlayerPresentation = (value: unknown): PlayerPresentation => {
  const source = value && typeof value === 'object' ? value as Partial<PlayerPresentation> : {};
  return { quiet: source.quiet === true, density: source.density === 'compact' ? 'compact' : 'standard',
    waveformAccent: ['cover', 'neutral', 'orange', 'blue'].includes(source.waveformAccent ?? '')
      ? source.waveformAccent! : 'cover' };
};
export const WAVEFORM_ACCENT_LABELS: Record<WaveformAccent, string> = {
  cover: 'Cover-Farbe', neutral: 'Neutral', orange: 'Orange', blue: 'Blau',
};
export const getVisibleProgressInterval = (quiet: boolean): number => quiet ? 1000 : 500;
