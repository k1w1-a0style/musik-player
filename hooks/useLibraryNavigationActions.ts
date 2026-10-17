import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Song } from '../types/Song';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';

export interface UseLibraryNavigationActionsResult {
  openTagCleaner: (songIds: string[]) => void;
  openTrackInfo: (song: Song) => void;
  openEqualizer: () => void;
  openSettings: () => void;
  openPlaylistDetail: (playlistId: string) => void;
}

export const useLibraryNavigationActions = (): UseLibraryNavigationActionsResult => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const openTrackInfo = useCallback((song: Song) => {
    navigation.navigate(APP_STACK_ROUTES.TRACK_INFO, { songId: song.id });
  }, [navigation]);

  const openEqualizer = useCallback(() => {
    navigation.navigate(APP_STACK_ROUTES.EQUALIZER);
  }, [navigation]);

  const openSettings = useCallback(() => {
    navigation.navigate(APP_STACK_ROUTES.SETTINGS);
  }, [navigation]);

  const openPlaylistDetail = useCallback((playlistId: string) => {
    navigation.navigate('PlaylistDetail', { playlistId });
  }, [navigation]);

  const openTagCleaner = useCallback((songIds: string[]) => {
    navigation.navigate('TagCleaner', songIds.length ? { songIds } : undefined);
  }, [navigation]);
  return { openTagCleaner, openTrackInfo, openEqualizer, openSettings, openPlaylistDetail };
};
