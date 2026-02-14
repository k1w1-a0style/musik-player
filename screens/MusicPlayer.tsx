import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { theme } from '../theme';
import * as MediaLibrary from 'expo-media-library';
import { useMusicContext } from '../src/contexts/MusicContext';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';
import type { Song } from '../src/types/Song';

const MusicPlayer: React.FC = () => {
  const {
    queue,
    currentIndex,
    setQueue,
    currentPosition,
    duration,
    seekTo,
  } = useMusicContext();

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      console.error('Permission to read media library not granted');
      return;
    }

    try {
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: 'audio',
        first: 100,
      });

      const songs: Song[] = assets.map((asset) => ({
        uri: asset.uri,
        filename: asset.filename,
        duration: asset.duration,
      }));

      setQueue(songs);
    } catch (error) {
      console.error('Error loading songs:', error);
    }
  };

  const currentSong = useMemo(() => queue[currentIndex], [queue, currentIndex]);

  const renderSongItem = ({ item, index }: { item: Song; index: number }) => {
    const isActive = index === currentIndex;
    return (
      <TouchableOpacity
        style={[styles.songItem, isActive && styles.activeSongItem]}
        onPress={() => setQueue(queue, index)}
      >
        <Image
          source={{ uri: 'https://via.placeholder.com/50' }}
          style={styles.thumbnail}
        />
        <View style={styles.songInfo}>
          <Text
            style={[styles.songTitle, isActive && styles.activeSongTitle]}
            numberOfLines={1}
          >
            {item.filename}
          </Text>
          {item.duration && (
            <Text style={styles.songDuration}>
              {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.palette.background} />
      
      <View style={styles.nowPlayingContainer}>
        <Image
          source={{ uri: 'https://via.placeholder.com/200' }}
          style={styles.albumArt}
        />
        <Text style={styles.nowPlayingTitle} numberOfLines={1}>
          {currentSong?.filename || 'No song selected'}
        </Text>
        <Text style={styles.nowPlayingArtist}>Unknown Artist</Text>
      </View>

      <ProgressBar
        currentPosition={currentPosition}
        duration={duration}
        onSeek={seekTo}
      />

      <Controls />

      <View style={styles.queueHeader}>
        <Text style={styles.queueTitle}>Queue ({queue.length})</Text>
      </View>

      <FlatList
        data={queue}
        renderItem={renderSongItem}
        keyExtractor={(item, index) => `${item.uri}-${index}`}
        style={styles.songList}
        contentContainerStyle={styles.songListContent}
        showsVerticalScrollIndicator={false}
        initialScrollIndex={currentIndex}
        getItemLayout={(data, index) => ({
          length: 70,
          offset: 70 * index,
          index,
        })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  nowPlayingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  albumArt: {
    width: 200,
    height: 200,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  nowPlayingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  nowPlayingArtist: {
    fontSize: 16,
    color: theme.palette.text.secondary,
  },
  queueHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  songList: {
    flex: 1,
  },
  songListContent: {
    paddingBottom: theme.spacing.lg,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  activeSongItem: {
    backgroundColor: theme.palette.card,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.md,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.xs,
  },
  activeSongTitle: {
    color: theme.palette.primary,
    fontWeight: '600',
  },
  songDuration: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
});

export default MusicPlayer;
