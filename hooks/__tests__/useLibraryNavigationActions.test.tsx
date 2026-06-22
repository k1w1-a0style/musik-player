import { renderHook, act } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { useLibraryNavigationActions } from '../useLibraryNavigationActions';
import type { Song } from '../../types/Song';
import { APP_STACK_ROUTES } from '../../types/routes';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

const mockedUseNavigation = jest.mocked(useNavigation);

const song = (id: string): Song => ({
  id,
  title: id,
  artist: 'Artist',
  album: 'Album',
  uri: id,
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('openTrackInfo navigates to track info with song id', () => {
  const navigate = jest.fn();
  mockedUseNavigation.mockReturnValue({ navigate } as never);
  const { result } = renderHook(() => useLibraryNavigationActions());

  act(() => {
    result.current.openTrackInfo(song('track-1'));
  });

  expect(navigate).toHaveBeenCalledWith(APP_STACK_ROUTES.TRACK_INFO, { songId: 'track-1' });
});

test('openEqualizer navigates to the equalizer screen', () => {
  const navigate = jest.fn();
  mockedUseNavigation.mockReturnValue({ navigate } as never);
  const { result } = renderHook(() => useLibraryNavigationActions());

  act(() => {
    result.current.openEqualizer();
  });

  expect(navigate).toHaveBeenCalledWith(APP_STACK_ROUTES.EQUALIZER);
});
