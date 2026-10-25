import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import LibraryUpdateSettings from '../LibraryUpdateSettings';
import { LibraryUpdateProvider } from '../../contexts/LibraryUpdateContext';
import { storage } from '../../utils/storage';
jest.mock('../../utils/storage', () => ({ storage: { get: jest.fn(async () => null), set: jest.fn(async () => true) } }));
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { palette: {
  primary: '#eee', borderStrong: '#888', text: { primary: '#fff', secondary: '#ccc' } } } }) }));
test('hydration protects both switches and each choice preserves the other persisted field', async () => {
  const view = render(<LibraryUpdateProvider><LibraryUpdateSettings /></LibraryUpdateProvider>);
  expect(view.getByTestId('settings-library-update-onOpen').props.disabled).toBe(true);
  await waitFor(() => expect(view.getByTestId('settings-library-update-onOpen').props.disabled).toBe(false));
  await act(async () => { fireEvent(view.getByTestId('settings-library-update-onOpen'), 'valueChange', true); });
  expect(storage.set).toHaveBeenLastCalledWith('libraryUpdateV1', { onOpen: true, whileOpen: false });
  await act(async () => { fireEvent(view.getByTestId('settings-library-update-whileOpen'), 'valueChange', true); });
  expect(storage.set).toHaveBeenLastCalledWith('libraryUpdateV1', { onOpen: true, whileOpen: true });
  expect(view.getByText(/nur bei geöffneter App/)).toBeTruthy();
});
