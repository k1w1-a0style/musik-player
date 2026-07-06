import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useOptionalAppTheme } from '../contexts/AppThemeContext';
import { DEFAULT_APP_APPEARANCE } from '../utils/appTheme';
import { getLibraryListShellBackgroundColor } from '../utils/appThemeOverlays';

interface LibraryListShellProps {
  children: ReactNode;
  testID?: string;
}

const LibraryListShell: React.FC<LibraryListShellProps> = ({ children, testID = 'library-list-shell' }) => {
  const appTheme = useOptionalAppTheme();
  const backgroundColor = getLibraryListShellBackgroundColor(appTheme?.appearance ?? DEFAULT_APP_APPEARANCE);

  return (
    <View style={[styles.listShell, { backgroundColor }]} testID={testID}>
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
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});

export default LibraryListShell;
