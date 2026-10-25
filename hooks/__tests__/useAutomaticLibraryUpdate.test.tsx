import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useAutomaticLibraryUpdate } from '../useAutomaticLibraryUpdate';

let mockPreferences = { onOpen: false, whileOpen: true };
let mockHydrated = true;
jest.mock('../../contexts/LibraryUpdateContext', () => ({ useLibraryUpdatePreferences: () => ({ preferences: mockPreferences, isHydrated: mockHydrated }) }));
jest.mock('../../utils/libraryScanOperation', () => ({ getLibraryScanOperation: () => ({ status: 'idle' }) }));
let onAppState: (state: AppStateStatus) => void;
let onMedia: () => void;
let removeApp: jest.Mock;
let removeMedia: jest.Mock;
let permission: jest.Mock;
jest.mock('expo-media-library/legacy', () => ({ getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), addListener: jest.fn() }));
const options = () => ({ ready: true, busy: false, hasFolders: false, update: jest.fn(async () => undefined) });
const changeAppState = (state: AppStateStatus) => { AppState.currentState = state; onAppState(state); };
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); mockPreferences = { onOpen: false, whileOpen: true }; mockHydrated = true;
  AppState.currentState = 'active'; removeApp = jest.fn(); removeMedia = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => { onAppState = listener; return { remove: removeApp }; });
  permission = (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (MediaLibrary.addListener as jest.Mock).mockImplementation((listener: (event: { hasIncrementalChanges: boolean }) => void) => { onMedia = () => listener({ hasIncrementalChanges: false }); return { remove: removeMedia }; });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('starts an incremental update once after hydrated startup, using the granted folders', async () => {
  mockPreferences.onOpen = true;
  const props = { ...options(), hasFolders: true };
  const hook = renderHook(useAutomaticLibraryUpdate, { initialProps: props });
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).toHaveBeenCalledTimes(1);
  expect(props.update).toHaveBeenCalledWith({ source: 'folders', automatic: true });
  hook.rerender({ ...props });
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(props.update).toHaveBeenCalledTimes(1);
});

test('coalesces media events, throttles updates and performs no polling', async () => {
  const props = options(); const hook = renderHook(useAutomaticLibraryUpdate, { initialProps: props });
  await act(async () => { await Promise.resolve(); onMedia(); onMedia(); onMedia(); await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).toHaveBeenCalledTimes(1);
  await act(async () => { onMedia(); onMedia(); await jest.advanceTimersByTimeAsync(29_999); });
  expect(props.update).toHaveBeenCalledTimes(1);
  await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  expect(props.update).toHaveBeenCalledTimes(2);
  await act(async () => { await jest.advanceTimersByTimeAsync(300_000); });
  expect(props.update).toHaveBeenCalledTimes(2);
  hook.unmount(); expect(removeApp).toHaveBeenCalled(); expect(removeMedia).toHaveBeenCalled();
});

test('neither scans in background nor overlaps an active manual scan', async () => {
  const props = options(); const hook = renderHook(useAutomaticLibraryUpdate, { initialProps: props });
  await act(async () => { await Promise.resolve(); changeAppState('background'); onMedia(); await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).not.toHaveBeenCalled();
  hook.rerender({ ...props, busy: true });
  await act(async () => { changeAppState('active'); await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).not.toHaveBeenCalled();
});

test('disabled preferences remove automatic updates without affecting manual folder selection', async () => {
  mockPreferences = { onOpen: false, whileOpen: false };
  const props = options(); renderHook(useAutomaticLibraryUpdate, { initialProps: props });
  await act(async () => { changeAppState('background'); changeAppState('active'); await jest.advanceTimersByTimeAsync(60_000); });
  expect(props.update).not.toHaveBeenCalled(); expect(MediaLibrary.addListener).not.toHaveBeenCalled();
});

test('never asks for new permissions and waits for folder hydration', async () => {
  mockPreferences.onOpen = true;
  permission.mockResolvedValue({ status: 'denied', canAskAgain: true });
  const request = MediaLibrary.requestPermissionsAsync;
  const props = options(); const hook = renderHook(useAutomaticLibraryUpdate, { initialProps: { ...props, ready: false } });
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).not.toHaveBeenCalled();
  hook.rerender(props);
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
});

test('coalesces a change during a manual scan and updates after it becomes idle', async () => {
  const props = { ...options(), hasFolders: true, busy: true };
  const hook = renderHook(useAutomaticLibraryUpdate, { initialProps: props });
  await act(async () => { await Promise.resolve(); onMedia(); await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).not.toHaveBeenCalled();
  hook.rerender({ ...props, busy: false });
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).toHaveBeenCalledTimes(1);
});
