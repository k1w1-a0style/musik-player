export const LIBRARY_UPDATE_KEY = 'libraryUpdateV1';
export interface LibraryUpdatePreferences { onOpen: boolean; whileOpen: boolean }
export const DEFAULT_LIBRARY_UPDATE: Readonly<LibraryUpdatePreferences> = Object.freeze({ onOpen: true, whileOpen: true });
export const normalizeLibraryUpdate = (value: unknown): LibraryUpdatePreferences => {
  const source = value && typeof value === 'object' ? value as Partial<LibraryUpdatePreferences> : {};
  return { onOpen: typeof source.onOpen === 'boolean' ? source.onOpen : DEFAULT_LIBRARY_UPDATE.onOpen,
    whileOpen: typeof source.whileOpen === 'boolean' ? source.whileOpen : DEFAULT_LIBRARY_UPDATE.whileOpen };
};
