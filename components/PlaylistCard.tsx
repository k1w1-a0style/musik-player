import { View, Text, StyleSheet, Image } from 'react-native';
import { theme } from '../theme';

const PlaylistCard = ({ playlist }) => {
  return (
    <View style={styles.container}>
      <Image source={{ uri: playlist.cover }} style={styles.cover} />
      <Text style={styles.title}>{playlist.title}</Text>
      <Text style={styles.description}>{playlist.description}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
  },
  cover: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
    borderRadius: theme.borderRadius.sm,
  },
  title: {
    fontSize: 18,
    color: theme.palette.primary,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    color: theme.palette.text.secondary,
  },
});

export default PlaylistCard;