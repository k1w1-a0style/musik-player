# K1W1 Music V7

## Baseline

- `codex` and `main` started at `6d85428a0b4cdfaa863c98b2569cb3911dcd50cf`. CI passed on [codex](https://github.com/k1w1-a0style/musik-player/actions/runs/44406769475) and [main](https://github.com/k1w1-a0style/musik-player/actions/runs/44406833525). V7 changes go to `codex`.
- Reused the [V6 evidence](CODEX-V6-WORK-STATUS.md) for explicit Android source selection, source alias identity, base import with malformed artwork, all 16 playback cases, and small-screen geometry. The V6 APK was built from `a5ece6d25574496b26dad07ee0c1bd1aa43c5945`.
- All 14 V6 archive tags and the baseline tag are on GitHub. The persisted bundle was downloaded again, matched SHA-256 `44f78b6da9601c8ed01023a3798da4d142a520235c177ebec32af156ecde6457` and restored 47 branches into a fresh repository that passed `git fsck --full`.

## Confirmed fixes

- A delayed migration could publish an old library after a newer serialized write. `songLibraryStorage.ts` now checks the exact legacy bytes and manifest under the mutation lock. The regression covers the race and a disk-full retry after restart.
- The legacy favorites migration previously treated a failed or corrupt favorites read as an empty list and overwrote it. It now leaves those bytes and the migration marker untouched when input cannot be verified.
- An Android 10 legacy export hit a 12 MiB native heap allocation on a tiny backup. The same read path was still used by V7. `backupFiles.ts` now reads byte blocks of at most 256 KiB and decodes UTF-8 after reassembly. The total byte and text caps, exact export read-back and fresh-file cleanup remain enforced.
- A stalled MediaStore permission preflight could block later authorized folder updates. `useAutomaticLibraryUpdate.ts` bounds and cancels the preflight, reserves scan ownership for actual updates, and wakes the current scheduler after an older scan settles.
- Audio-info work could keep an obsolete revision or copy a projected URI into the underlying record. Backfill now matches the full file revision and applies the missing file facts without replacing the storage and playback URIs.
- The idle waveform index previously skipped all tracks over 20 minutes after restart and marked a canceled decoder waiter as attempted. Capable native builds now resume bounded previews and reuse the resulting cache. An interrupted waiter stays eligible. Older native builds retain the short-track bound.
- `AGENTS.md` now reflects the verified New Architecture and RNTP v5 configuration. The native architecture remains unchanged.

## Verification

- Host storage tests passed for migration, corruption, rollback, and persistence budgets. Upgrade fixtures cover legacy settings, edited metadata, current song and resume position, favorites, playlist IDs, inactive Download entries, and backup compatibility. A backup regression exercises a small Android allocation budget, malformed data, UTF-8 across block boundaries, and the existing size limits.
- The original `1.0.2-test.12` APK was recovered from [CI 40413357386](https://github.com/k1w1-a0style/musik-player/actions/runs/40413357386). SHA-256 `3cf9a5196b40d46701e1abe05f4eb1e18c16019561ea472b01582033dbc732e6`. It has the same verified signing certificate as V6.
- The signed `1.0.2-test.18` passed fresh scans on API 29 and 35 and in-place update, backup inspection, and native 65-minute MP3/WAV/FLAC seeking on API 35.
- The signed `1.0.2-test.19` is version code 21 from `dbb08b9f9a262c2caa609230e6e037403e531575`. Its SHA-256 is `426c8dffe69de5c29319228122dbf8f5dc589ae2c416ac3969de4cb4506d9186`. The quality, security and native jobs passed in the [signed APK build](https://github.com/k1w1-a0style/musik-player/actions/runs/44453623486), with 459 Jest suites, 4,446 Jest tests, 223 native tests and a verified APK v2 signature. The production audit reports three moderate findings and zero high or critical findings.
- The [corrected harness CI](https://github.com/k1w1-a0style/musik-player/actions/runs/44630845865) passed all required checks, including 231 host diagnostic tests. The test changes recognize the exact system root header and recover from the Android 10 sort popup. Each playlist addition now confirms its actual row identity and order before the next touch.
- Fresh scans on [API 29](https://github.com/k1w1-a0style/musik-player/actions/runs/44630845948/job/135936999441) and [API 35](https://github.com/k1w1-a0style/musik-player/actions/runs/44630845948/job/135936999320) imported 16 titles in one pass, played all 16 through the native decoder, kept stable IDs when a folder was removed and re-added, and kept the last row reachable at 200% font size. Download appeared only with device-wide music enabled. An inaccessible source produced one read warning.
- In-place upgrades on [API 29](https://github.com/k1w1-a0style/musik-player/actions/runs/44630845948/job/135936999535) and [API 35](https://github.com/k1w1-a0style/musik-player/actions/runs/44630845948/job/135936999367) preserved the installation, SAF grant, song IDs, favorite, playlist order and a measured resume position. Both exported a new verified backup, mapped the old backup read-only, and preserved the SHA-256 hashes of all seven test audio files. Native playback and waveform preview passed after seeking in 65-minute MP3, WAV and FLAC files.
- The [full public UI retest](https://github.com/k1w1-a0style/musik-player/actions/runs/44630846010) passed 16 integration checks and 36 font, theme and density cases at 320 dp on the same `test.19` APK. It covers native background playback, queue gestures, process restart, SAF backup export and restore, and a verified tag edit on synthetic audio. The source build's original UI job stopped at the recorded DocumentsUI navigation failure. The corrected harness completed the full retest without rebuilding the APK.

## Open and deferred

- Audio was verified through native playback state and position in the emulators. Listening and battery checks on a physical Samsung remain open.
- GitHub has nine remote branches. Dependabot #408 and #416–#421 remain open for separate qualification. Expo SDK, dev client, React Native and React Native Screens updates need coordinated native qualification. Zod is a patch candidate. Workflow and lint tooling proposals can be qualified independently.
- ReplayGain is deferred. The current RNTP volume contract is global and capped at unity gain. A future gain stage needs native per-track handoff and peak headroom before EQ, with persisted opt-in.

## Samsung Android 10 practice test

1. Export a K1W1 backup. Note the current track, a favorite, one playlist and its order, and a saved position in a long mix.
2. Install the signed V7 APK as an update over the installed K1W1. If Android reports a conflicting signature, keep the installed app and record the message.
3. Open K1W1 and keep only the Music folder selected. With Android storage read access granted and “Gesamte Gerätemusik” off, search for a known Download track by exact title. Turn the option on, refresh, confirm that track appears once, then switch it off and verify the title is hidden.
4. Play two titles with missing artwork or waveform. Seek past the midpoint of a mix over an hour long, pause, close the app, and confirm the saved position on restart.
5. Remove and re-add the Music folder within K1W1. Confirm the original files, favorite and playlist order survive. Enable large system text, scroll to the last title and tap it above the mini-player. If anything fails, capture the Android version, APK version, action and app-owned error message.
