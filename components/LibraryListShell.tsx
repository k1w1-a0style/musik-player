import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface LibraryListShellProps {
  children: ReactNode;
  testID?: string;
}

const LibraryListShell: React.FC<LibraryListShellProps> = ({ children, testID = 'library-list-shell' }) => (
  <View style={styles.listShell} testID={testID}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  listShell: {
    flex: 1,
    marginTop: 0,
    marginHorizontal: 0,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
});

export default LibraryListShell;
