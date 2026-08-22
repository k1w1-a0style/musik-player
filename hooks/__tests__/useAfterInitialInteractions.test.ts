import { act, renderHook } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';
import { useAfterInitialInteractions } from '../useAfterInitialInteractions';

test('defers optional work until initial interactions finish and cancels on unmount', () => {
  let completeInteractions!: () => void;
  const cancel = jest.fn();
  const schedule = jest.spyOn(InteractionManager, 'runAfterInteractions')
    .mockImplementation(task => {
      completeInteractions = () => {
        if (typeof task === 'function') task();
        else void task?.gen();
      };
      return {
        cancel,
        done: jest.fn(),
        then: jest.fn(() => Promise.resolve()),
      };
    });
  const rendered = renderHook(() => useAfterInitialInteractions());

  expect(rendered.result.current).toBe(false);
  act(() => completeInteractions());
  expect(rendered.result.current).toBe(true);

  rendered.unmount();
  expect(cancel).toHaveBeenCalledTimes(1);
  schedule.mockRestore();
});
