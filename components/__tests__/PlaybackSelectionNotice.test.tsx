import React from 'react';
import { act, render } from '@testing-library/react-native';
import PlaybackSelectionNotice from '../PlaybackSelectionNotice';
import { AppThemeProvider } from '../../contexts/AppThemeContext';
import { beginPlaybackSelection, finishPlaybackSelection, getPlaybackSelectionSnapshot, resetPlaybackSelectionForTests } from '../../utils/playbackSelectionStatus';

beforeEach(resetPlaybackSelectionForTests);

test('shows a desired title separately and an older completion cannot clear a newer target', async () => {
  const view = render(<PlaybackSelectionNotice topInset={24} />, { wrapper: AppThemeProvider });
  await act(async () => undefined);
  expect(view.queryByTestId('playback-selection-notice')).toBeNull();
  let older!: number; let newer!: number;
  act(() => { older = beginPlaybackSelection({ id: 'one', title: 'One' }); });
  expect(view.getByText('Wechsel zu „One“ …')).toBeTruthy();
  act(() => { newer = beginPlaybackSelection({ id: 'two', title: 'Two' }); });
  act(() => { expect(finishPlaybackSelection(older)).toBe(false); });
  expect(view.getByText('Wechsel zu „Two“ …')).toBeTruthy();
  expect(getPlaybackSelectionSnapshot().target?.id).toBe('two');
  act(() => { expect(finishPlaybackSelection(newer)).toBe(true); });
  expect(view.queryByTestId('playback-selection-notice')).toBeNull();
});

test('blank title gets a readable transition hint', async () => {
  const view = render(<PlaybackSelectionNotice />, { wrapper: AppThemeProvider });
  await act(async () => undefined);
  act(() => { beginPlaybackSelection({ id: 'one', title: ' ' }); });
  expect(view.getByText('Wechsel zu „Unbekannter Titel“ …')).toBeTruthy();
  act(resetPlaybackSelectionForTests);
  expect(view.queryByTestId('playback-selection-notice')).toBeNull();
});
