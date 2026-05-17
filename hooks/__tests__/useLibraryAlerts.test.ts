import { Alert } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useLibraryAlerts } from '../useLibraryAlerts';

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

afterEach(() => {
  jest.clearAllMocks();
});

test('showAlert forwards title and message to native alert', () => {
  const { result } = renderHook(() => useLibraryAlerts());

  act(() => {
    result.current.showAlert({ title: 'Titel', message: 'Nachricht' });
  });

  expect(Alert.alert).toHaveBeenCalledWith('Titel', 'Nachricht');
});
