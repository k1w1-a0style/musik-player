import { resolveAutomaticLibrarySource } from '../automaticLibrarySources';
test.each([
  [true, 'granted', 'both'], [true, 'denied', 'folders'],
  [false, 'granted', 'media-library'],
] as const)('automatically combines only authorized sources %s/%s', async (folders, status, expected) => {
  expect(await resolveAutomaticLibrarySource(folders, async () => ({ status }), true)).toBe(expected);
});
test('a failed permission query cannot block an authorized folder', async () => {
  expect(await resolveAutomaticLibrarySource(true, async () => { throw Error('provider'); }, true)).toBe('folders');
});
test('an explicit first update may request missing media access only without folders', async () => {
  expect(await resolveAutomaticLibrarySource(false, async () => ({ status: 'denied' }), false)).toBe('media-library');
  await expect(resolveAutomaticLibrarySource(false, async () => ({ status: 'denied' }), true)).rejects.toThrow('Musikzugriff');
});
