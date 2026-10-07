import { PlayerCommand, RepeatMode as NativeRepeatMode, type MediaItem } from '@rntp/player';
import { Capability, RepeatMode, type Progress, type Track } from './types';

/** Native optional numeric fields must be absent, rather than serialized null. */
export const omitUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;

export const toMediaItem = (track: Track): MediaItem => {
  if (typeof track.url !== 'string' || !track.url.trim()) throw new Error('Track URL is required.');
  const { id, url, title, artist, album, artwork, duration, headers, isLiveStream, contentType, ...extras } = track;
  return omitUndefined({
    mediaId: id === undefined ? undefined : String(id),
    url: headers ? { uri: url, headers } : url,
    title, artist, albumTitle: album, artworkUrl: artwork, duration,
    isLive: isLiveStream, mimeType: contentType, extras: omitUndefined(extras),
  });
};

const resolvedUrl = (url: MediaItem['url']): string => {
  if (typeof url === 'string') return url;
  if (typeof url === 'object' && typeof url.uri === 'string') return url.uri;
  throw new Error('Native playback returned an unresolved media URL.');
};

export const fromMediaItem = (item: MediaItem): Track => ({
  ...item.extras,
  id: item.mediaId,
  url: resolvedUrl(item.url),
  title: item.title, artist: item.artist, album: item.albumTitle,
  artwork: item.artworkUrl == null ? undefined : resolvedUrl(item.artworkUrl),
  duration: item.duration, isLiveStream: item.isLive, contentType: item.mimeType,
  ...(typeof item.url === 'object' && item.url.headers ? { headers: item.url.headers } : {}),
});

export const toNativeRepeatMode = (mode: RepeatMode): NativeRepeatMode => {
  if (mode === RepeatMode.Track) return NativeRepeatMode.One;
  if (mode === RepeatMode.Queue) return NativeRepeatMode.All;
  if (mode === RepeatMode.Off) return NativeRepeatMode.Off;
  throw new Error(`Invalid repeat mode: ${mode}`);
};

export const fromNativeRepeatMode = (mode: NativeRepeatMode): RepeatMode => {
  if (mode === NativeRepeatMode.One) return RepeatMode.Track;
  if (mode === NativeRepeatMode.All) return RepeatMode.Queue;
  return RepeatMode.Off;
};

const COMMANDS: Record<Capability, PlayerCommand> = {
  [Capability.Play]: PlayerCommand.PlayPause,
  [Capability.Pause]: PlayerCommand.PlayPause,
  [Capability.Stop]: PlayerCommand.Stop,
  [Capability.SeekTo]: PlayerCommand.Seek,
  [Capability.SkipToNext]: PlayerCommand.Next,
  [Capability.SkipToPrevious]: PlayerCommand.Previous,
  [Capability.JumpForward]: PlayerCommand.SkipForward,
  [Capability.JumpBackward]: PlayerCommand.SkipBackward,
};

export const toCommands = (capabilities: Capability[]): PlayerCommand[] =>
  [...new Set(capabilities.map(capability => {
    const command = COMMANDS[capability];
    if (!command) throw new Error(`Unsupported playback capability: ${capability}`);
    return command;
  }))];

const seconds = (value: number): number => Number.isFinite(value) && value > 0 ? value : 0;
export const toProgress = (progress: Progress): Progress => ({
  position: seconds(progress.position), duration: seconds(progress.duration), buffered: seconds(progress.buffered),
});
