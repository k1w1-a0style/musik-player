import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useMediaLibraryAuthorization } from '../useMediaLibraryAuthorization';
import { publishMediaLibraryAuthorization } from '../../utils/mediaLibraryAuthorizationState';
jest.mock('expo-media-library/legacy', () => ({ getPermissionsAsync: jest.fn() }));
beforeEach(() => { publishMediaLibraryAuthorization(undefined); jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());
test('a late pre-grant permission query cannot overwrite a verified grant; foreground revocation is detected', async () => {
  let finish!: (value: { status: string }) => void;
  let foreground!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    foreground = handler; return { remove };
  });
  const get = MediaLibrary.getPermissionsAsync as jest.Mock;
  get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = renderHook(() => useMediaLibraryAuthorization(null));
  act(() => publishMediaLibraryAuthorization(true));
  await act(async () => finish({ status: 'denied' }));
  expect(view.result.current).toBe(true);
  get.mockResolvedValue({ status: 'denied' });
  act(() => foreground('active'));
  await waitFor(() => expect(view.result.current).toBe(false));
  expect(get).toHaveBeenLastCalledWith(false, ['audio']);
  view.unmount(); expect(remove).toHaveBeenCalledTimes(1); listener.mockRestore();
});
test('a permission service error remains unknown and never requests access', async () => {
  (MediaLibrary.getPermissionsAsync as jest.Mock).mockRejectedValue(new Error('service unavailable'));
  const view = renderHook(() => useMediaLibraryAuthorization(null));
  await act(async () => undefined);
  expect(view.result.current).toBeUndefined();
});
