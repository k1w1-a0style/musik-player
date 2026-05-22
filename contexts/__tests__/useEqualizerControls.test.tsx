import React from 'react';
import { Button, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { EQ_BAND_COUNT, EQ_PRESETS } from '../../types/Song';
import { updateEqBandAtIndex, useEqualizerControls } from '../useEqualizerControls';

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
      <Button testID="preset-rock" title="preset" onPress={() => applyEqPreset('rock')} />
    </>
  );
};

describe('useEqualizerControls', () => {
  test('updates one EQ band without mutating the previous array', () => {
    const source = [0, 0, 0];
    const updated = updateEqBandAtIndex(source, 1, 5);

    expect(updated).toHaveLength(EQ_BAND_COUNT);
    expect(updated.slice(0, 3)).toEqual([0, 5, 0]);
    expect(updated.slice(3)).toEqual(Array(EQ_BAND_COUNT - 3).fill(0));
    expect(source).toEqual([0, 0, 0]);
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
});
