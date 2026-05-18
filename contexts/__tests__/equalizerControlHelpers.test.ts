import { EQ_PRESETS } from '../../types/Song';
import {
  createDefaultEqBands,
  getEqPresetBands,
  updateEqBandAtIndex,
} from '../equalizerControlHelpers';

describe('equalizerControlHelpers', () => {
  test('creates default flat eq bands as a copy', () => {
    const bands = createDefaultEqBands();

    expect(bands).toEqual(EQ_PRESETS.flat);
    expect(bands).not.toBe(EQ_PRESETS.flat);
  });

  test('updates one EQ band without mutating the previous array', () => {
    const source = [0, 0, 0];
    const updated = updateEqBandAtIndex(source, 1, 5);

    expect(updated).toEqual([0, 5, 0]);
    expect(source).toEqual([0, 0, 0]);
  });

  test('gets preset bands as a copy', () => {
    const bands = getEqPresetBands('rock');

    expect(bands).toEqual(EQ_PRESETS.rock);
    expect(bands).not.toBe(EQ_PRESETS.rock);
  });
});
