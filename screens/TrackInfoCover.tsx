import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Music2 } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';

interface TrackInfoCoverProps {
  coverUri?: string;
  coverFailed: boolean;
  onCoverError: () => void;
}

const TrackInfoCover: React.FC<TrackInfoCoverProps> = ({
  coverUri,
  coverFailed,
  onCoverError,
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.coverWrap, { backgroundColor: theme.palette.surfaceElevated }]}>
      {coverUri && !coverFailed ? (
        <Image source={{ uri: coverUri }} style={styles.cover} onError={onCoverError} />
      ) : (
        <Music2 color={theme.palette.text.muted} size={42} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  coverWrap: {
    width: 116,
    height: 116,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cover: { width: '100%', height: '100%' },
});

export default TrackInfoCover;
