import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { theme as staticTheme } from '../theme';
import type { AppStackParamList } from '../types/navigation';
import type { Song } from '../types/Song';

type PlaylistDetailRoute = RouteProp<AppStackParamList, 'PlaylistDetail'>;

const playlistTrackLabel = (count: number): string => `${count} Titel`;

const PlaylistDetail: React.FC = () => {
  const route = useRoute<PlaylistDetailRoute>();
  const { theme } = useAppTheme();
  const { playlists, songs } = useLibraryMusicContext();
  const playlistId = route.params.playlistId;

  const playlist = useMemo(
    () => playlists.find(item => item.id === playlistId),
    [playlistId, playlists],
  );

  const playlistSongs = useMemo(() => {
    if (!playlist) return [];
    const songsById = new Map(songs.map(song => [song.id, song]));
    return playlist.songIds.flatMap(songId => {
      const song = songsById.get(songId);
      return song ? [song] : [];
    });
  }, [playlist, songs]);

  const missingSongs = playlist ? Math.max(playlist.songIds.length - playlistSongs.length, 0) : 0;

  const renderSong: ListRenderItem<Song> = ({ item, index }) => (
    <View
      style={[styles.songRow, { borderBottomColor: theme.palette.border }]}
      testID={`playlist-detail-song-${item.id}`}
    >
      <Text style={[styles.songIndex, { color: theme.palette.text.muted }]}>{index + 1}</Text>
      <View style={styles.songTextWrap}>
        <Text style={[styles.songTitle, { color: theme.palette.text.primary }]} numberOfLines={1}>
          {item.title || 'Unbekannter Titel'}
        </Text>
        <Text style={[styles.songSubtitle, { color: theme.palette.text.secondary }]} numberOfLines={1}>
          {item.artist || 'Unbekannter Künstler'}
        </Text>
      </View>
    </View>
  );

  if (!playlist) {
    return (
      <View
        style={[styles.root, styles.centered, { backgroundColor: theme.palette.background }]}
        testID="playlist-detail-not-found"
      >
        <Text style={[styles.title, { color: theme.palette.text.primary }]}>Playlist nicht gefunden</Text>
        <Text style={[styles.subtitle, { color: theme.palette.text.secondary }]}>Diese Playlist existiert nicht mehr.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.palette.background }]} testID="playlist-detail-screen">
      <FlatList
        data={playlistSongs}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderSong}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.palette.text.primary }]} numberOfLines={2}>
              {playlist.name}
            </Text>
            <Text style={[styles.subtitle, { color: theme.palette.text.secondary }]}>
              {playlistTrackLabel(playlistSongs.length)}
            </Text>
            {missingSongs > 0 && (
              <Text style={[styles.warning, { color: theme.palette.error }]}>
                {missingSongs} nicht mehr gefunden
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={(
          <Text style={[styles.empty, { color: theme.palette.text.muted }]} testID="playlist-detail-empty">
            Diese Playlist ist noch leer.
          </Text>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: staticTheme.spacing.lg,
    gap: staticTheme.spacing.sm,
  },
  content: {
    padding: staticTheme.spacing.md,
    paddingBottom: 96,
  },
  header: {
    gap: staticTheme.spacing.xs,
    marginBottom: staticTheme.spacing.lg,
  },
  title: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 14,
  },
  warning: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 14,
    marginTop: staticTheme.spacing.xl,
    textAlign: 'center',
  },
  songRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  songIndex: {
    width: 24,
    textAlign: 'right',
    fontFamily: staticTheme.fonts.body,
    fontSize: 12,
  },
  songTextWrap: { flex: 1, minWidth: 0 },
  songTitle: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 15,
  },
  songSubtitle: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
});

export default PlaylistDetail;
