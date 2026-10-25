export const LIBRARY_UPDATE_KEY = 'libraryUpdateV1';
export interface LibraryUpdatePreferences { onOpen: boolean; whileOpen: boolean }
export const DEFAULT_LIBRARY_UPDATE: Readonly<LibraryUpdatePreferences> = Object.freeze({ onOpen: false, whileOpen: true });
export const normalizeLibraryUpdate = (value: unknown): LibraryUpdatePreferences => {
  const source = value && typeof value === 'object' ? value as Partial<LibraryUpdatePreferences> : {};
  return { onOpen: source.onOpen === true, whileOpen: source.whileOpen !== false };
};
