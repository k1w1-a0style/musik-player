const TrackPlayerModule = require('react-native-track-player');
const AsyncStorage = require('@react-native-async-storage/async-storage');

const TrackPlayer = TrackPlayerModule.default ?? TrackPlayerModule;

afterEach(() => {
  TrackPlayer.__reset?.();
  AsyncStorage.__reset?.();
  jest.clearAllMocks();
});
