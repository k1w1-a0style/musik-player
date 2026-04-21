export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  uri?: string;
  cover?: string;
  duration?: number;
}
