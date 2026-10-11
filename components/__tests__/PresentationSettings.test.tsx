import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Animated, AccessibilityInfo, Text } from 'react-native';
import PresentationSettings from '../PresentationSettings';
import CoverBassPulse from '../CoverBassPulse';
import { PlayerPresentationProvider } from '../../contexts/PlayerPresentationContext';
import { useCoverBassPulse } from '../../hooks/useCoverBassPulse';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import CrossfadeLayers from '../CrossfadeLayers';
import { storage } from '../../utils/storage';
import { getAppTheme } from '../../utils/appTheme';

const mockTheme = getAppTheme('dark', 'graphite');
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: mockTheme }) }));
jest.mock('../../utils/storage', () => ({ storage: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(true) } }));
jest.mock('../../hooks/useCoverBassPulse', () => ({ useCoverBassPulse: jest.fn(() => 1) }));
beforeEach(() => { jest.clearAllMocks(); (storage.get as jest.Mock).mockResolvedValue(null); });

test('settings apply density, accent and quiet together without overwriting each other', async () => {
  const screen = render(<PlayerPresentationProvider><PresentationSettings /></PlayerPresentationProvider>);
  await waitFor(() => expect(screen.getByTestId('settings-density-compact').props.accessibilityState.disabled).toBe(false));
  fireEvent.press(screen.getByTestId('settings-density-compact'));
  fireEvent.press(screen.getByTestId('settings-waveform-accent-neutral'));
  fireEvent(screen.getByTestId('settings-quiet-profile'), 'valueChange', true);
  await waitFor(() => expect(storage.set).toHaveBeenLastCalledWith('playerPresentationV3', {
    quiet: true, density: 'compact', waveformAccent: 'neutral',
  }));
  expect(screen.getByTestId('settings-density-compact').props.accessibilityState.checked).toBe(true);
  expect(screen.getByTestId('settings-waveform-accent-neutral').props.accessibilityState.checked).toBe(true);
});

test('quiet profile stops the bass controller and color transitions; switching back restores the selected pulse', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  const song = { id: 'mix', title: 'Mix', artist: 'DJ' };
  const Child = ({ color }: { color: string }) => <>
    <PresentationSettings />
    <CoverBassPulse enabled song={song} isPlaying><Text>Cover</Text></CoverBassPulse>
    <CrossfadeLayers value={color} valueKey={color} renderLayer={value => <Text>{value}</Text>} testID="colors" />
  </>;
  const screen = render(<PlayerPresentationProvider><Child color="one" /></PlayerPresentationProvider>);
  await waitFor(() => expect(screen.getByTestId('settings-quiet-profile').props.disabled).toBe(false));
  expect(useCoverBassPulse).toHaveBeenCalled();
  fireEvent(screen.getByTestId('settings-quiet-profile'), 'valueChange', true);
  (useCoverBassPulse as jest.Mock).mockClear(); timing.mockClear();
  screen.rerender(<PlayerPresentationProvider><Child color="two" /></PlayerPresentationProvider>);
  expect(useCoverBassPulse).not.toHaveBeenCalled();
  expect(timing).not.toHaveBeenCalled();
  expect(screen.queryByTestId('colors-outgoing', { includeHiddenElements: true })).toBeNull();
  fireEvent(screen.getByTestId('settings-quiet-profile'), 'valueChange', false);
  expect(useCoverBassPulse).toHaveBeenCalled();
  await act(async () => {});
  timing.mockRestore();
});

test('quiet combines with the system motion setting and does not turn it off', async () => {
  const system = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const Probe = () => <Text testID="motion">{String(useReducedMotion())}</Text>;
  const screen = render(<PlayerPresentationProvider><PresentationSettings /><Probe /></PlayerPresentationProvider>);
  await waitFor(() => expect(screen.getByTestId('motion').props.children).toBe('true'));
  fireEvent(screen.getByTestId('settings-quiet-profile'), 'valueChange', true);
  fireEvent(screen.getByTestId('settings-quiet-profile'), 'valueChange', false);
  expect(screen.getByTestId('motion').props.children).toBe('true');
  await act(async () => {});
  system.mockRestore();
});
