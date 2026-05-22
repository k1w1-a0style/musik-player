import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useAsyncInFlightGuard } from '../useAsyncInFlightGuard';

interface ProbeProps {
  actions: Array<() => Promise<void>>;
  onDone?: () => void;
}

const GuardProbe = ({ actions, onDone }: ProbeProps) => {
  const runOnce = useAsyncInFlightGuard();

  useEffect(() => {
    void Promise.all(actions.map(action => runOnce(action))).then(onDone);
  }, [actions, onDone, runOnce]);

  return null;
};

describe('useAsyncInFlightGuard', () => {
  test('runs a single action', async () => {
    const action = jest.fn(async () => undefined);
    const onDone = jest.fn();

    render(<GuardProbe actions={[action]} onDone={onDone} />);

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(action).toHaveBeenCalledTimes(1);
  });

  test('ignores overlapping actions while one is in flight', async () => {
    let release: () => void = () => undefined;
    const first = jest.fn(async () => new Promise<void>(resolve => {
      release = resolve;
    }));
    const second = jest.fn(async () => undefined);
    const onDone = jest.fn();

    render(<GuardProbe actions={[first, second]} onDone={onDone} />);

    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    expect(second).not.toHaveBeenCalled();

    release();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  test('releases guard after action rejection', async () => {
    const first = jest.fn(async () => {
      throw new Error('rejected');
    });
    const second = jest.fn(async () => undefined);

    const Probe = () => {
      const runOnce = useAsyncInFlightGuard();
      useEffect(() => {
        void runOnce(first).catch(() => undefined).then(() => runOnce(second));
      }, [runOnce]);
      return null;
    };

    render(<Probe />);

    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
  });
});
