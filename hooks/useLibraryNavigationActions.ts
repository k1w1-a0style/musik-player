import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Song } from '../types/Song';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';

export const useLibraryNavigationActions = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const openTrackInfo = useCallback((song: Song) => {
    navigation.navigate(APP_STACK_ROUTES.TRACK_INFO, { songId: song.id });
  }, [navigation]);

  return { openTrackInfo };
};
