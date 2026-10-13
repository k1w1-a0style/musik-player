# Unveröffentlichte Scan-Navigationsregression

Dieser Patch wurde unmittelbar vor dem Infrastrukturabbruch angefordert, aber nicht bestätigt. Vor Anwendung prüfen, ob er lokal bereits vorhanden ist.

Zieldatei: hooks/__tests__/useLibraryImportStateUpdate.test.tsx.
Imports ergänzen: React; act neben renderHook; type LibraryTab aus ../../utils/libraryTabs.
Die bestehenden song/generation-Helfer weiterverwenden.

```tsx
test('later chunks and final publication retain the tab chosen after the first confirmed songs', async () => {
  const state = createSongLibraryState([]);
  state.configurePersistence(async read => read());
  state.configureImportPublication(jest.fn());
  const view = renderHook(() => {
    const [tab, setActiveTab] = React.useState<LibraryTab>('tracks');
    const actions = useLibraryImportStateUpdate({ songs: [], setSongs: jest.fn(), songImport: state,
      setActiveTab, ensureCurrentImport: jest.fn() });
    return { ...actions, tab, chooseTab: setActiveTab };
  });
  const active = generation();
  await act(async () => { await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate([], [song('first')]), active); });
  act(() => view.result.current.chooseTab('playlists'));
  await act(async () => { await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate([], [song('second')]), active); });
  act(() => { view.result.current.publishImportedSongs(active); });
  expect(view.result.current.tab).toBe('playlists');
  expect(state.getSnapshot().map(item => item.id)).toEqual(['first', 'second']);
  await act(async () => { await view.result.current.applyImportedSongsUpdate(buildImportedSongsUpdate([], [song('third')]), generation(2)); });
  expect(view.result.current.tab).toBe('tracks');
});
```

Noch nicht ausgeführt. Produktivursache ist im tatsächlichen Code bestätigt: publishImportedSongs setzt bei jedem Chunk/finalen Publish unconditionally setActiveTab('tracks'). Kleiner Fixkandidat: eine Importgeneration nur bei ihrer ersten erfolgreichen Veröffentlichung zur Titelansicht aktivieren; spätere Veröffentlichungen erhalten die gewählte Ansicht. Stale-/Cancel-/Speicherprüfungen beibehalten.
