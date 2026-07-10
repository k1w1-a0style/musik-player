import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, MoreHorizontal } from 'lucide-react-native';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';

interface NowPlayingHeaderProps {
  albumTitle: string;
  onClose: () => void;
  onMore: () => void;
}

const NowPlayingHeader = React.memo(({ albumTitle, onClose, onMore }: NowPlayingHeaderProps) => {
  const { theme } = useAppTheme();

  return (
    <View style={styles.headerBar}>
      <Pressable
        testID="now-playing-close"
        style={styles.headerBtn}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Wiedergabe schließen"
      >
        <ChevronDown color={theme.palette.text.primary} size={22} />
      </Pressable>
      <View style={styles.headerTitleWrap}>
        <Text style={[styles.headerEyebrow, { color: theme.palette.text.muted }]}>JETZT LÄUFT</Text>
        <Text style={[styles.headerTitle, { color: theme.palette.text.primary }]} numberOfLines={1}>
          {albumTitle}
        </Text>
      </View>
      <Pressable
        testID="now-playing-more"
        style={styles.headerBtn}
        onPress={onMore}
        accessibilityRole="button"
        accessibilityLabel="Wiedergabe-Menü öffnen"
      >
        <MoreHorizontal color={theme.palette.text.primary} size={22} />
      </Pressable>
    </View>
  );
});

NowPlayingHeader.displayName = 'NowPlayingHeader';

const styles = StyleSheet.create({
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 2 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { alignItems: 'center', flex: 1 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.8, fontFamily: APP_THEME_TOKENS.fonts.body },
  headerTitle: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 14, marginTop: 2 },
});

export default NowPlayingHeader;
