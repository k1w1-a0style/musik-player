import React from 'react';
import { View, TextInput, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

type Tags = {
  title: string;
  artist: string;
  album: string;
};

type Props = {
  tags: Tags;
  onChange: (newTags: Tags) => void;
};

const Id3TagForm: React.FC<Props> = ({ tags, onChange }) => {
  const handleChange = (field: keyof Tags, value: string) => {
    onChange({ ...tags, [field]: value });
  };

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Titel</Text>
      <TextInput
        style={styles.input}
        value={tags.title}
        onChangeText={(t) => handleChange('title', t)}
        placeholder="Titel"
        placeholderTextColor={theme.palette.text.secondary}
      />
      <Text style={styles.label}>Interpret</Text>
      <TextInput
        style={styles.input}
        value={tags.artist}
        onChangeText={(t) => handleChange('artist', t)}
        placeholder="Interpret"
        placeholderTextColor={theme.palette.text.secondary}
      />
      <Text style={styles.label}>Album</Text>
      <TextInput
        style={styles.input}
        value={tags.album}
        onChangeText={(t) => handleChange('album', t)}
        placeholder="Album"
        placeholderTextColor={theme