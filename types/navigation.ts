export type AppStackParamList = {
  MainTabs: undefined;
  NowPlaying: undefined;
  TrackInfo: { songId: string };
  TagEditor: { songId: string };
  TagCleaner: { songIds?: string[] } | undefined;
  Equalizer: undefined;
  Settings: undefined;
  PlaylistDetail: { playlistId: string };
};
