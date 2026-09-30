import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getArtworkSource } from '../utils/songArtwork';

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
      <Image source={getArtworkSource(coverFailed ? undefined : coverUri)} style={styles.cover}
        resizeMethod="resize" fadeDuration={0}
        onError={coverUri && !coverFailed ? onCoverError : undefined} />
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
