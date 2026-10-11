import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { PlayerPresentationProvider, usePlayerPresentation } from '../PlayerPresentationContext';
import { storage } from '../../utils/storage';
import { DEFAULT_PLAYER_PRESENTATION, PLAYER_PRESENTATION_KEY } from '../../utils/playerPresentation';

jest.mock('../../utils/storage', () => ({ storage: {
  get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(true),
} }));
const wrapper = ({ children }: { children: React.ReactNode }) => <PlayerPresentationProvider>{children}</PlayerPresentationProvider>;
beforeEach(() => { jest.clearAllMocks(); (storage.get as jest.Mock).mockResolvedValue(null); });

test('existing installs receive Standard, cover accent and quiet off without a migration write', async () => {
  const hook = renderHook(usePlayerPresentation, { wrapper });
  await waitFor(() => expect(hook.result.current.isHydrated).toBe(true));
  expect(hook.result.current.presentation).toEqual(DEFAULT_PLAYER_PRESENTATION);
  expect(storage.get).toHaveBeenCalledWith(PLAYER_PRESENTATION_KEY);
  expect(storage.set).not.toHaveBeenCalled();
});

test('all three preferences survive a provider restart and malformed fields fall back individually', async () => {
  (storage.get as jest.Mock).mockResolvedValue({ quiet: true, density: 'compact', waveformAccent: 'blue' });
  const first = renderHook(usePlayerPresentation, { wrapper });
  await waitFor(() => expect(first.result.current.isHydrated).toBe(true));
  expect(first.result.current.presentation).toEqual({ quiet: true, density: 'compact', waveformAccent: 'blue' });
  first.unmount();
  const second = renderHook(usePlayerPresentation, { wrapper });
  await waitFor(() => expect(second.result.current.isHydrated).toBe(true));
  expect(second.result.current.presentation).toEqual(first.result.current.presentation);
  second.unmount();
  (storage.get as jest.Mock).mockResolvedValue({ quiet: 'false', density: 'unknown', waveformAccent: 'purple' });
  const invalid = renderHook(usePlayerPresentation, { wrapper });
  await waitFor(() => expect(invalid.result.current.isHydrated).toBe(true));
  expect(invalid.result.current.presentation).toEqual(DEFAULT_PLAYER_PRESENTATION);
});

test('changing one preference preserves the others in confirmed serial writes', async () => {
  (storage.get as jest.Mock).mockResolvedValue({ quiet: true, density: 'compact', waveformAccent: 'blue' });
  const hook = renderHook(usePlayerPresentation, { wrapper });
  await waitFor(() => expect(hook.result.current.isHydrated).toBe(true));
  act(() => hook.result.current.setPresentation?.(previous => ({ ...previous, waveformAccent: 'neutral' })));
  await waitFor(() => expect(storage.set).toHaveBeenLastCalledWith(PLAYER_PRESENTATION_KEY,
    { quiet: true, density: 'compact', waveformAccent: 'neutral' }));
});

test('failed storage rolls the visible setting back to the last confirmed value', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  (storage.set as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  const hook = renderHook(usePlayerPresentation, { wrapper });
  await waitFor(() => expect(hook.result.current.isHydrated).toBe(true));
  act(() => hook.result.current.setPresentation?.(previous => ({ ...previous, quiet: true })));
  await waitFor(() => expect(warn).toHaveBeenCalled());
  expect(hook.result.current.presentation.quiet).toBe(false);
  warn.mockRestore();
});
