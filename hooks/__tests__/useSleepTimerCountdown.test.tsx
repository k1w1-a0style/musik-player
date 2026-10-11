import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useSleepTimerCountdown } from '../useSleepTimerCountdown';

const originalState = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(0);
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true, writable: true }); });
afterEach(() => { Object.defineProperty(AppState, 'currentState', originalState); jest.restoreAllMocks(); jest.useRealTimers(); });

test('only a visible label owns a periodic countdown and refreshes immediately on reopening', async () => {
  const hook = renderHook(({ visible }: { visible: boolean }) => useSleepTimerCountdown(60_000, visible), { initialProps: { visible: false } });
  expect(jest.getTimerCount()).toBe(0); expect(hook.result.current).toBe(60);
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  hook.rerender({ visible: true }); expect(hook.result.current).toBe(30); expect(jest.getTimerCount()).toBe(1);
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); }); expect(hook.result.current).toBe(29);
  hook.rerender({ visible: false }); expect(jest.getTimerCount()).toBe(0); hook.unmount();
});

test('suspends the label clock in background and reads the real deadline on return', async () => {
  let onChange!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { onChange = callback; return { remove: jest.fn() }; });
  const hook = renderHook(() => useSleepTimerCountdown(60_000));
  act(() => { onChange('background'); }); expect(jest.getTimerCount()).toBe(0);
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  act(() => { onChange('active'); }); expect(hook.result.current).toBe(30); expect(jest.getTimerCount()).toBe(1);
  hook.unmount(); expect(jest.getTimerCount()).toBe(0);
});

test('deadline replacement and cancellation immediately update only the countdown', () => {
  const hook = renderHook(({ deadline }: { deadline: number | null }) => useSleepTimerCountdown(deadline), { initialProps: { deadline: 60_000 } });
  hook.rerender({ deadline: 120_000 }); expect(hook.result.current).toBe(120);
  hook.rerender({ deadline: null }); expect(hook.result.current).toBeNull(); expect(jest.getTimerCount()).toBe(0);
});
