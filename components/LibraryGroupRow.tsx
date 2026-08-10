import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Play } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import type { LibraryGroupItem } from '../utils/libraryPresentation';

interface LibraryGroupRowProps {
  group: LibraryGroupItem;
  onPress: (group: LibraryGroupItem) => void;
}

const LibraryGroupRowComponent: React.FC<LibraryGroupRowProps> = ({ group, onPress }) => {
  const { theme } = useAppTheme();
  const [coverFailed, setCoverFailed] = useState(false);
  const coverSource = useMemo(() => group.cover ? { uri: group.cover } : null, [group.cover]);

  useEffect(() => {
    setCoverFailed(false);
  }, [group.cover, group.id]);

  const handlePress = useCallback(() => {
    onPress(group);
  }, [group, onPress]);

  const handleCoverError = useCallback(() => {
    setCoverFailed(true);
  }, []);

  const showCover = coverSource !== null && !coverFailed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${group.title} abspielen`}
      style={({ pressed }) => [
        styles.groupRow,
        { borderBottomColor: theme.palette.border },
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
      testID={`library-group-row-${group.id}`}
    >
      <View style={[styles.groupIcon, { backgroundColor: theme.palette.surfaceGlass }]}>
        {showCover ? (
          <Image source={coverSource!} style={styles.groupCover} accessible={false}
            resizeMethod="resize" fadeDuration={0} testID={`library-group-cover-${group.id}`}
            onError={handleCoverError} />
        ) : (
          <Text style={[styles.groupIconText, { color: theme.palette.primary }]}>
            {group.title.slice(0, 1).toUpperCase() || '?'}
          </Text>
        )}
      </View>
      <View style={styles.groupTextWrap}>
        <Text style={[styles.groupTitle, { color: theme.palette.text.primary }]} numberOfLines={1}>
          {group.title}
        </Text>
        <Text style={[styles.groupSubtitle, { color: theme.palette.text.secondary }]}>
          {group.subtitle}
        </Text>
      </View>
      <Play color={theme.palette.text.secondary} size={16} />
    </Pressable>
  );
};

const LibraryGroupRow = memo(LibraryGroupRowComponent);

const styles = StyleSheet.create({
  groupRow: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  groupCover: { width: '100%', height: '100%' },
  groupIconText: { fontFamily: staticTokens.fonts.heading, fontSize: 18 },
  groupTextWrap: { flex: 1, minWidth: 0 },
  groupTitle: { fontFamily: staticTokens.fonts.heading, fontSize: 15 },
  groupSubtitle: { fontFamily: staticTokens.fonts.body, fontSize: 12, marginTop: 2 },
  pressed: { opacity: 0.72 },
});

export default LibraryGroupRow;
