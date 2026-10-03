# Library and player smoke-test corrections

Base: `codex` at `ebb5381670f425055fcce7bfe94a770a52456b08`.

## Import and preparation

- Adding a folder now automatically imports only that folder. Existing source
  documents are excluded before metadata, artwork or audio reads. SAF grants
  for overlapping trees are compared by provider and document ID.
- The main Importieren / Rescan action reads tags, covers and audio information
  together, then prepares the imported sources. The separate metadata menu
  action is removed. An explicit rescan can refresh existing metadata.
- Metadata refresh preserves existing song IDs, source URIs and audio import
  revisions when the file size is unchanged. Metadata corrections do not
  manufacture a new waveform identity or break playlist references.
- Preparation receives only imported sources, rather than the merged library.
  Persisted completion markers also avoid decoding already prepared tracks
  after waveform-cache eviction or a JavaScript restart.
- The current metadata file remains visible while concurrent readers run.
  Waveform progress comes from decoded PCM timestamps, is throttled to 200 ms,
  and is matched to the current native request. Cancellation rejects late
  updates. Current rows stay bright and show a thicker progress bar.
- Folder error persistence reloads an already saved new folder when the import
  callback still holds the state from before it was added.

## Waveform and cover transitions

- Display length is independent of the 1024-point waveform cache. The strip is
  resampled to two viewport widths, retaining peaks and the fixed center
  playhead. The original 1.5 px bars and 116 px height are restored.
- Reference: SoundCloud's official mobile screenshots and its explanation of
  [fixed-playhead waveform rendering](https://developers.soundcloud.com/blog/ios-waveform-rendering/).
  The two-screen span is this player's display choice, not a claimed exact
  pixel measurement of the current SoundCloud app.
- Native Animated writes can reach Android before React mounts reordered
  cover pages. Resetting the native translation to zero at that boundary can
  expose the outgoing cover again. Confirmed transitions now keep their
  native endpoint and commit the compensating layout offset together with
  the reordered, already loaded cover pages.
- Regression tests cover repeated next/previous transitions, either completion
  order, cancelled gestures, retained image instances and late callbacks.

## Verification

- 3,170 tests / 327 suites, including coverage thresholds, passed.
- TypeScript, ESLint without warnings, complexity and source-NUL gates passed.
- Expo dependency compatibility passed using its offline compatibility list.
- Native Kotlin compilation and Android unit tests run in the unchanged CI
  after this commit is pushed. The three new Kotlin reporter tests cover
  throttling, monotonic progress, completion and unknown duration.
- A freshly built native APK is required for PCM percentage events. Older APKs
  remain compatible and display indeterminate preparation instead.

The JavaScript tests establish the transition handoff contract. Android video
and the user's A50 smoke test are still needed to assess visible smoothness;
these tests alone are not evidence of a flawless device transition.
