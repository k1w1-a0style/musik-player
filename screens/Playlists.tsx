import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useMusic } from '../contexts/MusicContext';
import { theme } from '../theme';
import { Playlist } from '../types';

const Playlists: React.FC = () => {
  const {
    playlists,
    createPlaylist,
    deletePlaylist,
    setCurrentPlaylist,
  } = useMusic();
  const [modalVisible, setModalVisible] = useState(false);
  const [playlistName, setPlaylistName] = useState('');

  const handleCreatePlaylist = async () => {
    if (!playlistName.trim()) {
      Alert.alert('Fehler', 'Bitte gib einen Namen ein');
      return;
    }
    await createPlaylist(playlistName, []);
    setPlaylistName('');
    setModalVisible(false);
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    Alert.alert(
      'Playlist löschen',
      `Möchtest du "${playlist.name}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => deletePlaylist(playlist.id),
        },
      ]
    );
  };

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      style={styles.playlistItem}
      onPress={() => setCurrentPlaylist(item)}
      onLongPress={() => handleDeletePlaylist(item)}
    >
      <BlurView intensity={20} style={styles.playlistBlur}>
        <View style={styles.playlistIcon}>
          <Ionicons name="musical-notes" size={24} color={theme.palette.primary} />
        </View>
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName}>{item.name}</Text>
          <Text style={styles.playlistCount}>{item.songs.length} Songs</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.palette.text.secondary} />
      </BlurView>
