import { AccessibilityInfo } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useReducedMotion } from '../useReducedMotion';

describe('useReducedMotion', () => {
  afterEach(() => jest.restoreAllMocks());

  test('reads the system preference, follows changes, and removes its listener', async () => {
    let listener: ((enabled: boolean) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: unknown) => {
      if (event === 'reduceMotionChanged') listener = handler as (enabled: boolean) => void;
      return { remove };
    }) as never);

    const { result, unmount } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(true));

    act(() => listener?.(false));
    expect(result.current).toBe(false);

    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
