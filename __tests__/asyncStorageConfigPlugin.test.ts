/* eslint-disable @typescript-eslint/no-require-imports */
const {
  ASYNC_STORAGE_DATABASE_SIZE_KEY,
  ASYNC_STORAGE_DATABASE_SIZE_MB,
  upsertAsyncStorageDatabaseSize,
} = require('../plugins/withAsyncStorageDatabaseSize.js');

describe('AsyncStorage database size config plugin', () => {
  it('adds the configured Android database budget', () => {
    expect(upsertAsyncStorageDatabaseSize([])).toEqual([{
      type: 'property',
      key: ASYNC_STORAGE_DATABASE_SIZE_KEY,
      value: String(ASYNC_STORAGE_DATABASE_SIZE_MB),
    }]);
  });

  it('replaces a stale value without duplicating the property', () => {
    expect(upsertAsyncStorageDatabaseSize([
      { type: 'comment', value: 'keep' },
      { type: 'property', key: ASYNC_STORAGE_DATABASE_SIZE_KEY, value: '6' },
    ], 48)).toEqual([
      { type: 'comment', value: 'keep' },
      { type: 'property', key: ASYNC_STORAGE_DATABASE_SIZE_KEY, value: '48' },
    ]);
  });
});
