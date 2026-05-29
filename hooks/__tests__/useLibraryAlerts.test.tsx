import { Alert } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useLibraryAlerts } from '../useLibraryAlerts';

describe('useLibraryAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows native alert with title and message', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { result } = renderHook(() => useLibraryAlerts());

    act(() => {
      result.current.showAlert({ title: 'Titel', message: 'Nachricht' });
    });

    expect(alertSpy).toHaveBeenCalledWith('Titel', 'Nachricht');
  });
});
