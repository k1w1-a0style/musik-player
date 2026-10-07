import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * These methods are supplied by the audited V5 native patch. V5's ordinary
 * methods return void; a JS return must never release a still-active writer.
 */
interface AcknowledgedPlayer extends TurboModule {
  awaitReady(): Promise<void>;
  awaitPlaybackCommands(): Promise<void>;
  getPlayWhenReady(): boolean;
  getAudioSessionId(): Promise<number | null>;
}

export const nativePlayer = (): AcknowledgedPlayer => {
  const player = TurboModuleRegistry.getEnforcing<AcknowledgedPlayer>('TrackPlayer');
  if (typeof player.awaitReady !== 'function'
    || typeof player.awaitPlaybackCommands !== 'function'
    || typeof player.getPlayWhenReady !== 'function'
    || typeof player.getAudioSessionId !== 'function') {
    throw new Error('The native playback acknowledgement patch is missing. Rebuild the app.');
  }
  return player;
};

let mutationTail: Promise<void> = Promise.resolve();

export const mutate = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = mutationTail.then(async () => {
    await nativePlayer().awaitReady();
    return operation();
  });
  // A rejected operation is delivered to its caller; later recovery is allowed.
  // There is deliberately no deadline which could unlock an in-flight command.
  mutationTail = result.then(() => undefined, () => undefined);
  return result;
};

export const acknowledge = async (operation: () => void): Promise<void> => {
  operation();
  await nativePlayer().awaitPlaybackCommands();
};

export const read = async <T>(operation: () => T | Promise<T>): Promise<T> => {
  await nativePlayer().awaitReady();
  await mutationTail;
  return operation();
};
