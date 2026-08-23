/* eslint-disable @typescript-eslint/no-require-imports -- Expo config plugins are loaded as CommonJS. */
const { createRunOncePlugin, withGradleProperties } = require('expo/config-plugins');

const ASYNC_STORAGE_DATABASE_SIZE_KEY = 'AsyncStorage_db_size_in_MB';
const ASYNC_STORAGE_DATABASE_SIZE_MB = 32;

function upsertAsyncStorageDatabaseSize(properties, sizeMb = ASYNC_STORAGE_DATABASE_SIZE_MB) {
  const next = properties.filter(property => property.key !== ASYNC_STORAGE_DATABASE_SIZE_KEY);
  next.push({
    type: 'property',
    key: ASYNC_STORAGE_DATABASE_SIZE_KEY,
    value: String(sizeMb),
  });
  return next;
}

function withAsyncStorageDatabaseSize(config) {
  return withGradleProperties(config, config => {
    config.modResults = upsertAsyncStorageDatabaseSize(config.modResults);
    return config;
  });
}

const plugin = createRunOncePlugin(
  withAsyncStorageDatabaseSize,
  'k1w1-async-storage-database-size',
  '1.0.0',
);

module.exports = plugin;
module.exports.ASYNC_STORAGE_DATABASE_SIZE_KEY = ASYNC_STORAGE_DATABASE_SIZE_KEY;
module.exports.ASYNC_STORAGE_DATABASE_SIZE_MB = ASYNC_STORAGE_DATABASE_SIZE_MB;
module.exports.upsertAsyncStorageDatabaseSize = upsertAsyncStorageDatabaseSize;
