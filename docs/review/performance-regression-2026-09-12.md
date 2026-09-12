# Player performance regression repair — 2026-09-12

Target: `codex`, starting at `d7634a71`. Android development client; Track Player 4.1.2 requires the project's existing Legacy Architecture setting.

## Confirmed problems and repairs

- **Gesture runtime regression:** native `Animated.event` objects reached host `View`/`Pressable` listeners in the SoundCloud carousel and queue/playlist grips. The direct Gesture Handler child must be an animated component. A failing rendered-host regression test reproduced the listener-object error before the fix. The UI tests no longer manually unwrap event objects and thereby conceal invalid host props. Queue grip and row recognizers now track which one owns the drag, so a failed competing recognizer cannot cancel the winning drag.
- **Waveform disappears on pause/buffering:** keep the active waveform mounted independently of the playback boolean. Playback state controls interpolation only. Released seeks keep the target until native progress confirms it, with a bounded recovery timeout, instead of snapping to a stale poll.
- **White waveform/invisible midpoint:** enforce a readable colored accent with orange fallback for neutral/dark artwork, darken the played half, and draw a fixed 6 px dark outline with a 3 px bright playhead. Loading remains a straight line; no invented waveform is displayed. A failed analysis exposes an explicit retry.
- **First waveform CPU/I/O cost:** remove the 480-window random-seek/decoder-flush path. Decode sequentially with nonblocking input and bounded output waits; aggregate a bounded subset of true PCM into 1,024 buckets. A dedicated single background-priority executor isolates analysis from Expo's shared module queue. Cancellation is registered before dispatch, including queued requests. Remove the obsolete sampling planner and its tests.
- **Work at the wrong time:** prepare recent imported waveforms serially after interactions, only while the library is idle and the app is foregrounded. Playback/import/manual metadata refresh cancels this background lane. Cover/audio-info backfills also yield during playback/import. Foreground and adjacent requests retain priority. Existing valid cached shapes remain reusable.
- **Cache capacity:** retain 80 waveforms in memory and 256 on disk. Final native points are rounded to three decimal places before display/persistence, keeping per-track payloads small and identical across cache reuse. No cache-version wipe is required.
- **Metro imports:** the installed Lucide barrel pulled in 1,702 library modules for roughly 40 icons. A Babel transform resolves the installed package's actual named exports and aliases to individual modules. No icon geometry is copied and no runtime dependency is added. Device/export bundles use the transform; public-package Jest mocks retain their existing contract. Separate transform tests cover aliases and reject accidental namespace imports.
- **Queue latency:** native queue readback mapped each track through a linear library search, making large queues quadratic. It now builds one ID map. Independent native reads are batched into three stages while keeping the before/after consistency check and retry/recovery rules. Reorder continues to use `TrackPlayer.move`, without resetting audio. Queue dismissal also moves through a native animated event.

## Measurement and verification

Identical Android export options (`--no-bytecode --source-maps`), same dependency installation:

| Measurement | Baseline | Optimized measured snapshot |
|---|---:|---:|
| JavaScript bytes | 4,260,379 | 2,838,866 |
| Metro modules | 3,214 | 1,560 |
| Source-map modules | 3,221 | 1,567 |
| Lucide modules | 1,702 | 46 |

About 33% less JavaScript and 51% fewer modules. Small subsequent coordination/test additions do not change the icon reduction. These are bundle measurements, not a claim of equivalent startup improvement on a phone.

The user's `Android Bundled 163775ms` measures Metro before app startup. The hydration log separately reports about 4.7 seconds. It does not establish a two-minute native decoder duration. Development logs now emit per-load `[WaveformTiming]` cache/native/unavailable timings, and the native result includes `analysisDurationMs`.

Local final gate: 317 Jest suites / 3,045 tests passed with coverage; TypeScript, ESLint, code complexity, and generated Android permissions passed. Expo dependency compatibility was checked offline. Device/native verification is performed by the immutable-source APK workflow and recorded in its artifacts; a successful dev-launcher cold start alone is insufficient.

The new Android interaction smoke seeds three generated MP3/M4A/FLAC fixtures through the supported storage hydration path, serves the normal app entry over Metro, then uses Android input gestures for playing/paused seek, previous while playing, queue grip, next after native reorder, and playlist grip. It verifies real 1,024-point envelopes and stable cached shapes and captures screenshots, runtime logs and MediaSession state. Fixture seeding is test setup; it does not claim to test the user's SAF picker flow.

## Practical limits

SoundCloud's published waveform architecture prepares and caches peaks before playback; the client receives a small ready-made representation. A local player must analyze a new file somewhere. Idle precomputation and persistent cache move that work away from interaction, but uncached files still require decoding. No universal one-second guarantee or zero-jank guarantee follows from emulator tests. Long mixes, slow document providers, Bluetooth and the user's actual hardware still need measurements. Migrating architecture or changing the audio engine is not justified by the listener error.

References: [React Native Animated](https://reactnative.dev/docs/0.81/animated), [SoundCloud waveform data](https://developers.soundcloud.com/blog/waveforms-let-s-talk-about-them/), [SoundCloud rendering](https://developers.soundcloud.com/blog/ios-waveform-rendering/), [Expo tree shaking](https://docs.expo.dev/guides/tree-shaking/).

## Updating the phone's development environment

Install the new dev APK because the decoder changed natively. Pull `codex`, run `npm ci --no-audit --no-fund`, then `EXPO_NO_TELEMETRY=1 npx expo start --dev-client --lan`. Avoid routine `--clear`: it discards Metro's reusable transform cache. A cache reset is a troubleshooting step, not part of every start.
