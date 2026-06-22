import {
  beginMetadataRefreshActivity,
  endMetadataRefreshActivity,
  isMetadataRefreshActive,
  subscribeMetadataRefreshActivity,
  resetMetadataRefreshActivityForTests,
} from '../metadataRefreshActivity';

describe('metadataRefreshActivity', () => {
  beforeEach(() => {
    resetMetadataRefreshActivityForTests();
  });

  test('reports active state between begin and end', () => {
    expect(isMetadataRefreshActive()).toBe(false);
    beginMetadataRefreshActivity();
    expect(isMetadataRefreshActive()).toBe(true);
    endMetadataRefreshActivity();
    expect(isMetadataRefreshActive()).toBe(false);
  });

  test('supports nested activity and never drops below zero', () => {
    beginMetadataRefreshActivity();
    beginMetadataRefreshActivity();
    endMetadataRefreshActivity();
    expect(isMetadataRefreshActive()).toBe(true);
    endMetadataRefreshActivity();
    endMetadataRefreshActivity();
    expect(isMetadataRefreshActive()).toBe(false);
  });

  test('notifies and stops notifying subscribers after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeMetadataRefreshActivity(listener);

    beginMetadataRefreshActivity();
    endMetadataRefreshActivity();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    beginMetadataRefreshActivity();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
