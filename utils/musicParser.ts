import * as FileSystem from 'expo-file-system';
import jsmediatags from 'jsmediatags';

interface MusicMetadata {
  title?: string;
  artist?: string;
  album?: string;
  cover?: string;
}

export const parseMusicFile = async (uri: string): Promise<MusicMetadata> => {
  return new Promise((resolve) => {
    jsmediatags.read(uri, {
      onSuccess: (tag) => {
        const { title, artist, album, picture } = tag.tags;
        let coverUri: string | undefined;

        if (picture) {
          const { data, format } = picture;
          const base64String = data.reduce(
            (acc: string, byte: number) => acc + String.fromCharCode(byte),
            ''
          );
          coverUri = `data:${format};base64,${btoa(base64String)}`;
        }

        resolve({
          title,
          artist,
          album,
          cover: coverUri,
        });
      },
      onError: () => {
        resolve({});
      },
    });
  });
};

export const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
