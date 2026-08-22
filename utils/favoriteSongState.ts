type FavoriteSongIdsListener = (songIds: readonly string[]) => void;

const listeners = new Set<FavoriteSongIdsListener>();
let revision = 0;
let latestSongIds: readonly string[] | null = null;

const copySongIds = (songIds: readonly string[]): readonly string[] => Object.freeze([...songIds]);

export const publishFavoriteSongIds = (songIds: readonly string[]): void => {
  revision += 1;
  latestSongIds = copySongIds(songIds);
  listeners.forEach(listener => {
    try {
      listener(latestSongIds!);
    } catch (error) {
      console.warn('[FavoriteSongState] Subscriber failed.', error);
    }
  });
};

export const subscribeFavoriteSongIds = (listener: FavoriteSongIdsListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getFavoriteSongIdsRevision = (): number => revision;

export const getPublishedFavoriteSongIds = (): readonly string[] | null => latestSongIds;

export const resetFavoriteSongStateForTests = (): void => {
  listeners.clear();
  revision = 0;
  latestSongIds = null;
};
