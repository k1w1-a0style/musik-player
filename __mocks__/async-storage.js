/**
 * In-memory mock for @react-native-async-storage/async-storage.
 */
let store = new Map();

const AsyncStorage = {
  getItem: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
  setItem: jest.fn(async (key, value) => {
    store.set(key, value);
  }),
  removeItem: jest.fn(async key => {
    store.delete(key);
  }),
  clear: jest.fn(async () => {
    store.clear();
  }),
  multiGet: jest.fn(async keys => keys.map(k => [k, store.has(k) ? store.get(k) : null])),
  multiSet: jest.fn(async pairs => {
    pairs.forEach(([k, v]) => store.set(k, v));
  }),
  getAllKeys: jest.fn(async () => [...store.keys()]),
  __reset: () => {
    store = new Map();
  },
  __getStore: () => store,
};

module.exports = {
  __esModule: true,
  default: AsyncStorage,
};
