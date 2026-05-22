import React from 'react';
import { Button, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { EQ_BAND_COUNT, EQ_PRESETS } from '../../types/Song';
import { isValidEqBandIndex, updateEqBandAtIndex, useEqualizerControls } from '../useEqualizerControls';

const EqualizerProbe = () => {
  const {
    eqEnabled,
    setEqEnabled,
    eqBands,
    setEqBand,
    eqPreset,
    applyEqPreset,
  } = useEqualizerControls();

  return (
    <>
      <Text testID="enabled">{String(eqEnabled)}</Text>
      <Text testID="bands">{eqBands.join(',')}</Text>
      <Text testID="preset">{eqPreset}</Text>
      <Button testID="enable" title="enable" onPress={() => setEqEnabled(true)} />
      <Button testID="band" title="band" onPress={() => setEqBand(1, 4)} />
      <Button testID="invalid-band" title="invalid" onPress={() => setEqBand(-1, 4)} />
      <Button testID="clamped-band" title="clamp" onPress={() => setEqBand(2, 99)} />
      <Button testID="preset-rock" title="preset" onPress={() => applyEqPreset('rock')} />
    </>
  );
};

describe('useEqualizerControls', () => {
  test('validates EQ band indexes', () => {
    expect(isValidEqBandIndex(0)).toBe(true);
    expect(isValidEqBandIndex(EQ_BAND_COUNT - 1)).toBe(true);
    expect(isValidEqBandIndex(-1)).toBe(false);
    expect(isValidEqBandIndex(EQ_BAND_COUNT)).toBe(false);
    expect(isValidEqBandIndex(1.5)).toBe(false);
  });

  test('updates one EQ band without mutating the previous array', () => {
    const source = [0, 0, 0];
    const updated = updateEqBandAtIndex(source, 1, 5);

    expect(updated).toHaveLength(EQ_BAND_COUNT);
    expect(updated.slice(0, 3)).toEqual([0, 5, 0]);
    expect(updated.slice(3)).toEqual(Array(EQ_BAND_COUNT - 3).fill(0));
    expect(source).toEqual([0, 0, 0]);
  });

  test('returns a copied array for invalid EQ band indexes without changing values', () => {
    const source = [0, 1, 2];
    const updated = updateEqBandAtIndex(source, -1, 5);

    expect(updated).toEqual(source);
    expect(updated).not.toBe(source);
  });

  test('manages enabled state, custom band edits and presets', () => {
    const { getByTestId } = render(<EqualizerProbe />);

    expect(getByTestId('enabled').props.children).toBe('false');
    expect(getByTestId('preset').props.children).toBe('flat');

    fireEvent.press(getByTestId('enable'));
    expect(getByTestId('enabled').props.children).toBe('true');

    fireEvent.press(getByTestId('band'));
    expect(getByTestId('preset').props.children).toBe('custom');
    expect(getByTestId('bands').props.children.split(',')[1]).toBe('4');

    fireEvent.press(getByTestId('preset-rock'));
    expect(getByTestId('preset').props.children).toBe('rock');
    expect(getByTestId('bands').props.children).toBe(EQ_PRESETS.rock.join(','));
  });

  test('ignores invalid band edits without switching preset to custom', () => {
    const { getByTestId } = render(<EqualizerProbe />);
    const beforeBands = getByTestId('bands').props.children;

    fireEvent.press(getByTestId('invalid-band'));

    expect(getByTestId('preset').props.children).toBe('flat');
    expect(getByTestId('bands').props.children).toBe(beforeBands);
  });

  test('clamps valid band edits into the supported gain range', () => {
    const { getByTestId } = render(<EqualizerProbe />);

    fireEvent.press(getByTestId('clamped-band'));

    expect(getByTestId('preset').props.children).toBe('custom');
    expect(getByTestId('bands').props.children.split(',')[2]).toBe('12');
  });
});