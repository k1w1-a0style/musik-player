import { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { MINI_PLAYER_LIST_GAP, useMiniPlayerViewport } from '../contexts/MiniPlayerViewportContext';

/** The safe area is already reserved by Screen. Only scroll content reserves
 * the overlay, including grid views; the painted viewport keeps its full size. */
export const useLibraryListContentStyle = () => {
  const { bottomInset } = useMiniPlayerViewport();
  const safeAreaBottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return { paddingBottom: Math.max(MINI_PLAYER_LIST_GAP, bottomInset - safeAreaBottom) };
};
