import React, { useRef } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { usePersistedSetting } from '../usePersistedSetting';
import { StorageKeys, storage } from '../../utils/storage';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
};

const RaceProbe = ({ value, refs }: { value: number; refs: React.MutableRefObject<Record<string, string>> }) => {
  usePersistedSetting(true, StorageKeys.VOLUME, value, refs);
  return null;
};

const RefOwner = ({ value, onRefs }: { value: number; onRefs: (refs: React.MutableRefObject<Record<string, string>>) => void }) => {
  const refs = useRef<Record<string, string>>({});
  onRefs(refs);
  return <RaceProbe value={value} refs={refs} />;
};

describe('usePersistedSetting race handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps the latest rendered value as the final persisted cache for a key', async () => {
    const first = createDeferred<boolean>();
    const second = createDeferred<boolean>();
    const setSpy = jest.spyOn(storage, 'set')
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);
    let refs: React.MutableRefObject<Record<string, string>> | undefined;

    const { rerender } = render(<RefOwner value={0.2} onRefs={nextRefs => { refs = nextRefs; }} />);
    await waitFor(() => expect(setSpy).toHaveBeenCalledTimes(1));

    rerender(<RefOwner value={0.8} onRefs={nextRefs => { refs = nextRefs; }} />);
    expect(setSpy).toHaveBeenCalledTimes(1);

    first.resolve(true);
    await waitFor(() => expect(setSpy).toHaveBeenCalledTimes(2));
    expect(refs?.current[StorageKeys.VOLUME]).toBe(JSON.stringify(0.2));

    second.resolve(true);
    await waitFor(() => expect(refs?.current[StorageKeys.VOLUME]).toBe(JSON.stringify(0.8)));
    expect(setSpy).toHaveBeenNthCalledWith(1, StorageKeys.VOLUME, 0.2);
    expect(setSpy).toHaveBeenNthCalledWith(2, StorageKeys.VOLUME, 0.8);
  });
});
