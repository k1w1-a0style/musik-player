import React, { memo, useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Play } from 'lucide-react-native';
import { theme } from '../theme';
import type { LibraryGroupItem } from '../utils/libraryPresentation';

interface LibraryGroupRowProps {
  group: LibraryGroupItem;
  onPress: (group: LibraryGroupItem) => void;
}

const LibraryGroupRowComponent: React.FC<LibraryGroupRowProps> = ({ group, onPress }) => {
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setCoverFailed(false);
  }, [group.cover, group.id]);

  const handlePress = useCallback(() => {
    onPress(group);
  }, [group, onPress]);

  const handleCoverError = useCallback(() => {
    setCoverFailed(true);
  }, []);

  const showCover = !!group.cover && !coverFailed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${group.title} abspielen`}
      style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}
      onPress={handlePress}
      testID={`library-group-row-${group.id}`}
    >
      <View style={styles.groupIcon}>
        {showCover ? (
          <Image source={{ uri: group.cover }} style={styles.groupCover} testID={`library-group-cover-${group.id}`} onError={handleCoverError} />
        ) : (
          <Text style={styles.groupIconText}>{group.title.slice(0, 1).toUpperCase() || '?'}</Text>
        )}
      </View>
      <View style={styles.groupTextWrap}>
        <Text style={styles.groupTitle} numberOfLines={1}>{group.title}</Text>
        <Text style={styles.groupSubtitle}>{group.subtitle}</Text>
      </View>
      <Play color={theme.palette.text.secondary} size={16} />
    </Pressable>
  );
};

const LibraryGroupRow = memo(LibraryGroupRowComponent);

const styles = StyleSheet.create({
  groupRow: { height: 66, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.palette.border },
  groupIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  groupCover: { width: '100%', height: '100%' },
  groupIconText: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 18 },
  groupTextWrap: { flex: 1, minWidth: 0 },
  groupTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 15 },
  groupSubtitle: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
  pressed: { opacity: 0.72 },
});

export default LibraryGroupRow;
