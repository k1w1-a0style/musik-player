import React, { useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useOptionalAppTheme } from '../contexts/AppThemeContext';
import { DEFAULT_APP_APPEARANCE } from '../utils/appTheme';
import { getLibraryListShellBackgroundColor } from '../utils/appThemeOverlays';
import { MINI_PLAYER_LIST_GAP, useMiniPlayerViewport } from '../contexts/MiniPlayerViewportContext';

interface LibraryListShellProps {
  children: ReactNode;
  testID?: string;
}

const LibraryListShell: React.FC<LibraryListShellProps> = ({ children, testID = 'library-list-shell' }) => {
  const appTheme = useOptionalAppTheme();
  const { bottomInset } = useMiniPlayerViewport();
  const safeAreaBottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  // Screen already consumes the bottom safe area. Keep the remaining overlay
  // reserve inside this painted panel so its background continues behind the
  // player, while the actual list viewport stays above the floating controls.
  const paddingBottom = Math.max(MINI_PLAYER_LIST_GAP, bottomInset - safeAreaBottom);
  const backgroundColor = getLibraryListShellBackgroundColor(appTheme?.appearance ?? DEFAULT_APP_APPEARANCE);

  return (
    <View style={[styles.listShell, { backgroundColor, paddingBottom }]} testID={testID}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  listShell: {
    flex: 1,
    marginTop: 0,
    marginHorizontal: 0,
    paddingTop: 10,
    paddingHorizontal: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});

export default LibraryListShell;
