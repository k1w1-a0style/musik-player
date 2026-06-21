import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Song } from '../types/Song';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';

export interface UseLibraryNavigationActionsResult {
  openTrackInfo: (song: Song) => void;
  openEqualizer: () => void;
}

export const useLibraryNavigationActions = (): UseLibraryNavigationActionsResult => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const openTrackInfo = useCallback((song: Song) => {
    navigation.navigate(APP_STACK_ROUTES.TRACK_INFO, { songId: song.id });
  }, [navigation]);

  const openEqualizer = useCallback(() => {
    navigation.navigate(APP_STACK_ROUTES.EQUALIZER);
  }, [navigation]);

  return { openTrackInfo, openEqualizer };
};
