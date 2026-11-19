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

## Evidence and remaining verification

- Host storage tests passed for migration, corruption, rollback, and persistence budgets. Upgrade fixtures cover legacy settings, edited metadata, current song and resume position, favorites, playlist IDs, inactive Download entries, and backup compatibility.
- The original `1.0.2-test.12` APK was recovered from [CI 40413357386](https://github.com/k1w1-a0style/musik-player/actions/runs/40413357386). SHA-256 `3cf9a5196b40d46701e1abe05f4eb1e18c16019561ea472b01582033dbc732e6`. It has the same verified signing certificate as V6.
- The signed `1.0.2-test.18` passed fresh scans on API 29 and 35 and an in-place update plus native 65-minute MP3/WAV/FLAC seeking on API 35. The backup heap fix requires a new signed `1.0.2-test.19` APK and exact device verification. A physical Samsung remains outside the available test environment.
- Dependabot #408 and #416–#421 were open at the start. Expo SDK, dev client, React Native and React Native Screens updates need coordinated native qualification. Zod is a patch candidate. Workflow and lint tooling proposals can be qualified independently.
- ReplayGain is deferred. The current RNTP volume contract is global and capped at unity gain. A future gain stage needs native per-track handoff and peak headroom before EQ, with persisted opt-in.

## Samsung Android 10 practice test

1. Export a K1W1 backup. Note the current track, a favorite, one playlist and its order, and a saved position in a long mix.
2. Install the signed V7 APK as an update over the installed K1W1. If Android reports a conflicting signature, keep the installed app and record the message.
3. Open K1W1 and keep only the Music folder selected. With Android storage read access granted and “Gesamte Gerätemusik” off, search for a known Download track by exact title. Turn the option on, refresh, confirm that track appears once, then switch it off and verify the title is hidden.
4. Play two titles with missing artwork or waveform. Seek past the midpoint of a mix over an hour long, pause, close the app, and confirm the saved position on restart.
5. Remove and re-add the Music folder within K1W1. Confirm the original files, favorite and playlist order survive. Enable large system text, scroll to the last title and tap it above the mini-player. If anything fails, capture the Android version, APK version, action and app-owned error message.
