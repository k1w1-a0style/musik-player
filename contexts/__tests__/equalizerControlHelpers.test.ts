import { EQ_BAND_COUNT, EQ_PRESETS } from '../../types/Song';
import {
  clampEqBandGain,
  createDefaultEqBands,
  getEqPresetBands,
  isValidEqBandIndex,
  MAX_EQ_GAIN,
  MIN_EQ_GAIN,
  updateEqBandAtIndex,
} from '../equalizerControlHelpers';

describe('equalizerControlHelpers', () => {
  test('creates default flat eq bands as a copy', () => {
    const bands = createDefaultEqBands();

    expect(bands).toEqual(EQ_PRESETS.flat);
    expect(bands).not.toBe(EQ_PRESETS.flat);
  });

  test('clamps EQ band gain to a safe range', () => {
    expect(clampEqBandGain(6)).toBe(6);
    expect(clampEqBandGain(99)).toBe(MAX_EQ_GAIN);
    expect(clampEqBandGain(-99)).toBe(MIN_EQ_GAIN);
    expect(clampEqBandGain(Number.NaN)).toBe(0);
    expect(clampEqBandGain(Number.POSITIVE_INFINITY)).toBe(0);
  });

  test('validates EQ band indices', () => {
    expect(isValidEqBandIndex(0)).toBe(true);
    expect(isValidEqBandIndex(EQ_BAND_COUNT - 1)).toBe(true);
    expect(isValidEqBandIndex(-1)).toBe(false);
    expect(isValidEqBandIndex(EQ_BAND_COUNT)).toBe(false);
    expect(isValidEqBandIndex(1.5)).toBe(false);
  });

  test('updates one EQ band without mutating the previous array', () => {
    const source = EQ_PRESETS.flat.slice();
    const updated = updateEqBandAtIndex(source, 1, 5);

    expect(updated[1]).toBe(5);
    expect(source).toEqual(EQ_PRESETS.flat);
  });

  test('pads short arrays and clamps written values', () => {
    const updated = updateEqBandAtIndex([1, 2], 4, 99);

    expect(updated).toHaveLength(EQ_BAND_COUNT);
    expect(updated[0]).toBe(1);
    expect(updated[1]).toBe(2);
    expect(updated[4]).toBe(MAX_EQ_GAIN);
  });

  test('ignores invalid indices while returning a defensive copy', () => {
    const source = EQ_PRESETS.flat.slice();
    const updated = updateEqBandAtIndex(source, EQ_BAND_COUNT, 5);

    expect(updated).toEqual(source);
    expect(updated).not.toBe(source);
  });

  test('gets preset bands as a copy', () => {
    const bands = getEqPresetBands('rock');

    expect(bands).toEqual(EQ_PRESETS.rock);
    expect(bands).not.toBe(EQ_PRESETS.rock);
  });
});
