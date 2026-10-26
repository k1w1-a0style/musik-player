import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useAutomaticLibraryUpdate } from '../useAutomaticLibraryUpdate';

let mockPreferences = { onOpen: false, whileOpen: true };
let mockHydrated = true;
jest.mock('../../contexts/LibraryUpdateContext', () => ({ useLibraryUpdatePreferences: () => ({ preferences: mockPreferences, isHydrated: mockHydrated }) }));
let mockScanStatus = 'idle';
jest.mock('../../utils/libraryScanOperation', () => ({ getLibraryScanOperation: () => ({ status: mockScanStatus }) }));
let onAppState: (state: AppStateStatus) => void;
let onMedia: () => void;
let removeApp: jest.Mock;
let removeMedia: jest.Mock;
let permission: jest.Mock;
jest.mock('expo-media-library/legacy', () => ({ getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), addListener: jest.fn() }));
const options = () => ({ ready: true, busy: false, hasFolders: false, update: jest.fn(async () => undefined) });
const changeAppState = (state: AppStateStatus) => { AppState.currentState = state; onAppState(state); };
beforeEach(() => {
  mockScanStatus = 'idle';
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
  expect(props.update).toHaveBeenCalledWith({ source: 'auto', automatic: true });
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

test('retains a media change arriving during an automatic update, including the busy-to-idle transition', async () => {
  let finish!: () => void;
  const update = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const props = { ...options(), hasFolders: true, update };
  const hook = renderHook(useAutomaticLibraryUpdate, { initialProps: props });
  await act(async () => { await Promise.resolve(); onMedia(); await jest.advanceTimersByTimeAsync(1000); });
  expect(update).toHaveBeenCalledTimes(1);
  hook.rerender({ ...props, busy: true });
  await act(async () => { await Promise.resolve(); onMedia(); });
  hook.rerender(props);
  await act(async () => { finish(); await Promise.resolve(); await jest.advanceTimersByTimeAsync(30_000); });
  expect(update).toHaveBeenCalledTimes(2);
  await act(async () => { finish(); await Promise.resolve(); await jest.advanceTimersByTimeAsync(300_000); });
  expect(update).toHaveBeenCalledTimes(2);
});

test('a change during a long automatic update waits for real completion and never overlaps', async () => {
  let finish!: () => void;
  const update = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  renderHook(useAutomaticLibraryUpdate, { initialProps: { ...options(), hasFolders: true, update } });
  await act(async () => { await Promise.resolve(); onMedia(); await jest.advanceTimersByTimeAsync(1000); });
  await act(async () => { onMedia(); await jest.advanceTimersByTimeAsync(40_000); });
  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); await Promise.resolve(); await jest.advanceTimersByTimeAsync(1000); });
  expect(update).toHaveBeenCalledTimes(2);
  await act(async () => { finish(); await Promise.resolve(); await jest.advanceTimersByTimeAsync(300_000); });
  expect(update).toHaveBeenCalledTimes(2);
});

test('a denied automatic permission check does not schedule repeated permission polling', async () => {
  const props = options(); renderHook(useAutomaticLibraryUpdate, { initialProps: props });
  await act(async () => { await Promise.resolve(); });
  permission.mockResolvedValue({ status: 'denied' });
  await act(async () => { onMedia(); await jest.advanceTimersByTimeAsync(300_000); });
  expect(props.update).not.toHaveBeenCalled();
  expect(permission).toHaveBeenCalledTimes(2); // Listener eligibility, then one event-triggered check.
  expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled();
});

test('disabling foreground updates cancels their queued event while startup updates remain enabled', async () => {
  mockPreferences = { onOpen: true, whileOpen: true };
  const props = options(); const hook = renderHook(useAutomaticLibraryUpdate, { initialProps: props });
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).toHaveBeenCalledTimes(1);
  await act(async () => { onMedia(); });
  mockPreferences = { onOpen: true, whileOpen: false };
  hook.rerender(props);
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(props.update).toHaveBeenCalledTimes(1);
});

test('disabling startup updates cancels the queued startup without disabling media changes', async () => {
  mockPreferences = { onOpen: true, whileOpen: true };
  const props = options(); const hook = renderHook(useAutomaticLibraryUpdate, { initialProps: props });
  await act(async () => { await Promise.resolve(); });
  mockPreferences = { onOpen: false, whileOpen: true };
  hook.rerender(props);
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(props.update).not.toHaveBeenCalled();
  await act(async () => { onMedia(); await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).toHaveBeenCalledTimes(1);
});

test('a user folder scan consumes pending startup work and throttles the next lifecycle update', async () => {
  mockPreferences = { onOpen: true, whileOpen: true };
  permission.mockResolvedValue({ status: 'denied' });
  const props = options(); const hook = renderHook(useAutomaticLibraryUpdate, { initialProps: props });
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).not.toHaveBeenCalled();
  mockScanStatus = 'running'; hook.rerender({ ...props, busy: true, hasFolders: true });
  mockScanStatus = 'idle'; hook.rerender({ ...props, busy: false, hasFolders: true });
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(props.update).not.toHaveBeenCalled();
  act(() => { changeAppState('background'); changeAppState('active'); });
  await act(async () => { await jest.advanceTimersByTimeAsync(28_999); });
  expect(props.update).not.toHaveBeenCalled();
  await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  expect(props.update).toHaveBeenCalledTimes(1);
});
