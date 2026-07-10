import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';

interface NowPlayingMenuState {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  handleClose: () => void;
  openTrackInfo: () => void;
  openEqualizer: () => void;
}

export const useNowPlayingMenu = (songId?: string): NowPlayingMenuState => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [menuOpen, setMenuOpen] = useState(false);

  const openMenu = useCallback(() => {
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const openTrackInfo = useCallback(() => {
    setMenuOpen(false);
    if (!songId) return;
    navigation.navigate(APP_STACK_ROUTES.TRACK_INFO, { songId });
  }, [navigation, songId]);

  const openEqualizer = useCallback(() => {
    setMenuOpen(false);
    navigation.navigate(APP_STACK_ROUTES.EQUALIZER);
  }, [navigation]);

  return { menuOpen, openMenu, closeMenu, handleClose, openTrackInfo, openEqualizer };
};
