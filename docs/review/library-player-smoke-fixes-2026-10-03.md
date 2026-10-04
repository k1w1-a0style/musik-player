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

- 3,173 tests / 327 suites, including coverage thresholds, passed.
- TypeScript, ESLint without warnings, complexity and source-NUL gates passed.
- Expo dependency compatibility passed using its offline compatibility list.
- A separate native build with Node 20 and Java 17 passed Kotlin compilation,
  all 128 Android unit tests in 15 suites, and release APK assembly for
  arm64-v8a, armeabi-v7a, x86 and x86_64. New Architecture remains disabled.
  The three new Kotlin reporter tests cover throttling, monotonic progress,
  completion and unknown duration.
- Strict inspection of the built APK passed: package and label, ZIP integrity,
  native ABIs, manifest permissions and APK v2 signature. Its AndroidX Core
  app-private signature permission is now allowed by its exact release
  package name; unrelated package names remain rejected by regression tests.
- The preview APK contains PCM percentage events. Older APKs remain compatible
  and display indeterminate preparation instead.

## Native smoke results and remaining checks

- The APK updated the previous smoke installation without uninstalling it.
- On Android 15, adding the first folder imported and prepared its two tracks.
  Adding a second folder prepared only its one new track; the previous tracks
  remained ready. Tags and embedded covers were imported in the same flow,
  with no separate metadata menu action. Restarting kept the prepared state.
- Recordings show the current waveform scan row and its advancing progress
  bar. Synthetic tracks with distinct covers were used; no user library was
  modified.
- Visible cover-animation smoothness is still unverified. Recording and
  foreground control on the Android 15 test instance produced display/task
  switching and black frames. A fresh Android 14 attempt was started, but
  did not complete before the interrupted session. These recordings cannot
  establish either success or a remaining app animation defect.
- The JavaScript tests establish the transition handoff contract. Stable
  Android video and the user's A50 smoke test remain necessary before calling
  the cover transition flawless. SoundCloud's shorter display span is covered
  by rendering tests; its full native visual check remains open.

## Build artifact and CI status

- Runtime source: `b8cfb8bda8f2e3d293bd0d5bc9811700e8ec4668`.
- Artifact: `kiwi-music-codex-b8cfb8b-smoke.apk`, 94,990,197 bytes.
- SHA-256:
  `71280bacd99fca37422dc0d4abd29e21273e9a4c6051622a953613ad2b8524ab`.
- The subsequent permission-gate and report correction changes no app runtime
  code and requires no rebuild of this APK.
- [GitHub CI run 37158944216](https://github.com/k1w1-a0style/musik-player/actions/runs/37158944216)
  failed at the production dependency audit before tests or native compilation:
  21 high findings, no critical findings, rooted in `braces` and `node-forge`.
  No audit exceptions, forced dependency upgrades or weaker gates were added.
- [EAS preview run 37159293632](https://github.com/k1w1-a0style/musik-player/actions/runs/37159293632)
  uploaded the project but failed its build request before compilation.
  The successful separate native build above supplied the smoke APK.
