let granted: boolean | undefined;
let revision = 0;
const listeners = new Set<() => void>();
export const getMediaLibraryAuthorization = () => granted;
export const getMediaLibraryAuthorizationRevision = () => revision;
export const subscribeMediaLibraryAuthorization = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const publishMediaLibraryAuthorization = (value: boolean | undefined): void => {
  revision += 1;
  if (value === granted) return;
  granted = value;
  listeners.forEach(listener => listener());
};
