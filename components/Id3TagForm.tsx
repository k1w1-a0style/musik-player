import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { Song } from '../src/types/Song';

const Id3TagForm: React.FC<{ onSubmit: (song: Song) => void }> = ({ onSubmit }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  const handleSubmit = () => {
    onSubmit({ title, artist });
    setTitle('');
    setArtist('');
  };

  return (
    <View>
      <TextInput value={title} onChangeText={setTitle} placeholder="Title" />
      <TextInput value={artist} onChangeText={setArtist} placeholder="Artist" />
      <Button title="Submit" onPress={handleSubmit} />
    </View>
  );
};

export default Id3TagForm;
