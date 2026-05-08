import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Music2 } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';

const SongCard: React.FC<{ song: Song; onPress: () => void; isCurrent: boolean; isPlaying: boolean; }> = ({ song, onPress, isCurrent, isPlaying }) => (
  <Pressable testID={`song-card-${song.id}`} onPress={onPress} style={({ pressed }) => [styles.container, isCurrent && styles.currentSong, pressed && styles.pressed]}>
    <View style={[styles.cover, isCurrent && styles.coverActive]}>{song.cover ? <Image source={{ uri: song.cover }} style={styles.coverImage} /> : <Music2 color={isCurrent ? theme.palette.primary : theme.palette.text.muted} size={20} />}</View>
    <View style={styles.infoContainer}><Text style={[styles.title, isCurrent && styles.currentSongText]} numberOfLines={1}>{song.title}</Text><Text style={styles.artist} numberOfLines={1}>{song.artist}{song.album ? ` · ${song.album}` : ''}</Text></View>
    {isCurrent && <View style={[styles.dot, isPlaying && styles.dotActive]} />}
  </Pressable>
);
const styles = StyleSheet.create({container:{flexDirection:'row',alignItems:'center',padding:14,marginBottom:10,backgroundColor:theme.palette.card,borderRadius:theme.borderRadius.md,borderWidth:1,borderColor:theme.palette.border,gap:12},pressed:{opacity:.78},currentSong:{borderColor:theme.palette.borderStrong,...theme.shadows.glow},cover:{width:46,height:46,borderRadius:12,backgroundColor:theme.palette.surfaceElevated,alignItems:'center',justifyContent:'center',overflow:'hidden'},coverActive:{borderWidth:1,borderColor:theme.palette.primary},coverImage:{width:'100%',height:'100%'},infoContainer:{flex:1},title:{fontSize:15,color:theme.palette.text.primary,fontFamily:theme.fonts.heading},artist:{fontSize:12,color:theme.palette.text.secondary,marginTop:2,fontFamily:theme.fonts.body},currentSongText:{color:theme.palette.primary},dot:{width:8,height:26,borderRadius:8,backgroundColor:theme.palette.primaryGlow},dotActive:{backgroundColor:theme.palette.primary}});
export default SongCard;
