import { EQ_PRESETS, type EqPresetName } from '../types/Song';

export const PRESET_LABELS: Record<EqPresetName, string> = {
  flat: 'Flat',
  rock: 'Rock',
  pop: 'Pop',
  jazz: 'Jazz',
  bassBoost: 'Bass+',
  vocal: 'Vocal',
  electronic: 'Electronic',
};

export const PRESET_KEYS = Object.keys(EQ_PRESETS) as EqPresetName[];

export const formatHz = (hz: number): string =>
  hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}`;

export const buildEqualizerCurvePath = (
  eqBands: number[],
  width = 320,
  height = 80,
): string => {
  const points = eqBands.map((db, i) => {
    const x = (i / Math.max(1, eqBands.length - 1)) * width;
    const y = ((12 - db) / 24) * height;
    return { x, y };
  });

  if (points.length < 2) return `M0,${height / 2} L${width},${height / 2}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i += 1) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const cx1 = p0.x + (p1.x - p0.x) / 3;
    const cx2 = p0.x + ((p1.x - p0.x) * 2) / 3;
    d += ` C ${cx1} ${p0.y}, ${cx2} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  return d;
};
