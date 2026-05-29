# Music Context Architecture Map

## Round 8.5 scope

This is a maintenance map for the current provider/context layout. It documents existing structure only; it does not introduce a runtime architecture change.

## Provider stack

`MusicProvider` is the public provider exported from `contexts/MusicContext.tsx`. It calls `useMusicProviderController`, receives the full music value plus derived narrow context values, and renders `MusicContextProviders` around children.

`MusicContextProviders` nests the context providers in this order:

1. `MusicContext` for the full app-wide music surface.
2. `LibraryMusicContext` for the library screen subset.
3. `MiniPlayerMusicContext` for the compact player subset.
4. `NowPlayingMusicContext` for the now-playing subset.

The split keeps high-churn consumers from depending on the entire `MusicContextValue` when they only need a screen-specific slice.

## Contexts and hooks

| Context / hook | Main consumers | Value shape |
| --- | --- | --- |
| `MusicContext` / `useMusicContext` | Legacy or broad consumers that still need the full music surface | Songs, queue, playback controls, equalizer, visualizer, playlists, persistence-ready state, and library mutations. |
| `LibraryMusicContext` / `useLibraryMusicContext` | Library and tag-editor flows | Songs, `setSongs`, current song, play actions, readiness, playback state, metadata update, playlists, and playlist playback. |
| `MiniPlayerMusicContext` / `useMiniPlayerMusicContext` | `MiniPlayer` | Current song, play/pause, previous/next, and derived skip availability. |
| `NowPlayingMusicContext` / `useNowPlayingMusicContext` | Now Playing screen hooks/components | Queue, current song, seek, volume, visualizer/palette state, play action, save-queue-as-playlist, and derived skip availability. |

`useProvidedMusicContextValues` receives the full `MusicContextValue`, stabilizes it through `useMusicContextValue`, and memoizes the library, mini-player, and now-playing slices via the `build*MusicContextValue` helpers.

## Controller and action composition

`useMusicProviderController` wires the provider in layers:

- `useMusicProviderState` owns React state for readiness, songs, current song, queue, playlists, shuffle/repeat, equalizer, and volume.
- `useMusicProviderControls` owns playback/equalizer controls such as `usePlaybackControls`.
- `useMusicProviderAudioFeatures` owns visualizer/palette/native audio feature state.
- `useMusicPlaybackRefs` creates the queue and library refs used by actions and hydration.
- `useMusicProviderActions` composes library, queue, and playlist actions. `useLibraryActions` is the library mutation slice that prunes queues/playlists, syncs native queue state, and updates metadata references.
- `useMusicProviderEffects` performs hydration, persistence, current-song sync, album palette updates, and audio feature effects.

## Playback controls

`usePlaybackControls` is the TrackPlayer-facing playback hook. It derives `isPlaying` and `isBuffering` from `usePlaybackState`, exposes play/pause/stop/seek/next/previous helpers, and applies repeat/volume changes through the playback helper functions.

## Hydration and queue refs

Hydration enters through `useMusicHydration`, which calls `runMusicHydration` from `musicHydrationHelpers`. The important refs are:

- `songsRef`: latest hydrated library songs for persistence and current-song validation.
- `baseQueueContextRef`: the unshuffled logical queue used as the base for queue operations.
- `queueContextRef`: the active playable queue shown to React consumers.
- `nativeQueueRef`: the queue believed to be installed in React Native Track Player.

`runMusicHydration` sanitizes stored songs, normalizes duplicate IDs, restores playlists/settings, rebuilds playable queue state, and only resets/adds the native queue for the guarded cases already covered by hydration tests. A restored playable current song triggers native reset/add; a restored non-playable current song clears persisted current id, resets TrackPlayer, and empties `nativeQueueRef`. If there is no current song but the playable queue exists, hydration leaves the native queue untouched instead of doing a reset/add.

## ErrorBoundary pattern

Screen controller hooks must stay inside boundary inner components. The pattern is:

```tsx
const ScreenInner = () => {
  const controller = useScreenController();
  return <ScreenContent {...controller} />;
};

const Screen = () => (
  <ScreenFrame>
    <AppErrorBoundary>
      <ScreenInner />
    </AppErrorBoundary>
  </ScreenFrame>
);
```

`Library` follows this by keeping `useLibraryController` inside `LibraryScreenInner`, below `AppErrorBoundary`. The same maintenance rule applies to Now Playing and Tag Editor screen hooks: do not hoist screen hooks above their boundary wrapper, or render-time hook failures will bypass the screen-level fallback.

## Maintenance cautions

- Keep context slices narrow unless a consumer truly needs the full `MusicContext`.
- Keep queue mutations synchronized across React state, `queueContextRef`, `baseQueueContextRef`, and `nativeQueueRef`.
- Do not reset the native queue during hydration unless the current guarded branches require it.
- Preserve the `ScreenInner` under `AppErrorBoundary` shape when editing screen controllers.
