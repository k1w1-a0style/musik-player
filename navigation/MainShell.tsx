import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Library from '../screens/Library';
import AppErrorBoundary from '../components/AppErrorBoundary';
import MiniPlayer from '../components/MiniPlayer';

interface MainShellProps {
  openNowPlaying: () => void;
}

// The MiniPlayer floats just above the safe-area bottom now that the bottom
// tab bar is gone. This margin is independent of any tab bar inset.
export const MAIN_SHELL_MINI_PLAYER_MARGIN = 12;

const MainShell: React.FC<MainShellProps> = ({ openNowPlaying }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root} testID="main-shell">
      <Library />
      <AppErrorBoundary
        fallbackMessage="Player konnte nicht geladen werden."
        logPrefix="[MiniPlayer] ErrorBoundary caught an error"
        testID="mini-player-error-boundary-fallback"
        variant="compact"
        fallbackContainerStyle={{ bottom: insets.bottom + MAIN_SHELL_MINI_PLAYER_MARGIN }}
      >
        <MiniPlayer onOpen={openNowPlaying} />
      </AppErrorBoundary>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default MainShell;
