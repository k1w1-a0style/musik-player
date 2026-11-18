# K1W1 Music V6

## GitHub and baseline

- Baseline `d3ac70918b9ec83f579328f4e725a35acceb371f`. Fast-forwarded `main` from `b62b91b59c7400fd310a5db8fcbf9fc6444ff393` and independently verified both remote heads.
- Baseline CI run [44346716771](https://github.com/k1w1-a0style/musik-player/actions/runs/44346716771) passed quality, native and security jobs. Its exact-preview UI job was skipped.
- Initial inventory 47 branches. Of 45 cleanup candidates, 25 were already reachable from the baseline and 20 had independent history. The independent histories consist of earlier QA and evidence workflows, an offline V5 draft, and dependency proposals.
- `K1W1_V6_Git_Archiv_2026-11-18.bundle` contains the complete history and original names of all 47 branches, plus tags for the V6 baseline and pre-sync main. A fresh repository imported the bundle, passed `git fsck --full` and matched all 47 HEADs. The persisted file was downloaded and matched byte for byte. SHA-256 `44f78b6da9601c8ed01023a3798da4d142a520235c177ebec32af156ecde6457`.

## Implemented

- Android read permission no longer selects MediaStore. The explicit device-wide option defaults off for new and existing settings. Manual and automatic scans use the same selection and the saved records remain recoverable.
- Active scope applies to tracks, albums, artists, genres, favorites and playlist views. Verified overlapping folder aliases preserve the stored track ID and let the view use a selected source's URI. An unreadable source and a confirmed absent file remain distinct.
- Backup files accept the additional optional preference, including older backups that omit it. Playlist memberships and favorites stay persisted when a source is removed.
- Incremental SAF and MediaStore import defer native artwork. The 16-file regression confirms that corrupt artwork cannot hold up base import. Folder change events use selected document trees where the provider sends notifications. Startup and foreground scans also cover providers without notifications.
- Row progress and the header use the existing library and waveform receipts. Work is row-scoped, and the activity sheet provides source access, affected tracks and reasons, and targeted waveform retry.
- Playback failures carry a native track ID and platform error code. Waveform and artwork work remain optional. Optional analysis yields to playback. Audio info and cover retries are bounded and revision-aware. Native waveform previews sample 24 short windows for long mixes and carry a separate cache marker.
- Playlist play buttons use the active source list. M3U/M3U8 export still uses the saved playlist membership. Updated files are grouped in the source, UI, audio and verification commits.

## Evidence and next work

- Focused source, storage and playlist checks passed 18 suites / 440 tests. Focused UI checks passed 16 suites / 198 tests. Focused playback and waveform checks passed 11 suites / 188 tests.
- Final local Jest run passed 458 suites / 4,426 tests. TypeScript, ESLint, complexity and source-byte gates passed. Expo's offline check matched the bundled versions; its online lookup timed out locally.
- Production npm audit policy passed with 3 moderate findings and zero high or critical. The generated Android permission manifest and 219 Python diagnostic tests passed.
- The [first native run](https://github.com/k1w1-a0style/musik-player/actions/runs/44376947741) compiled and packaged the Android candidate. Its exact dispatch allowlist test caught the new SAF observer entry point. The allowlist now includes that method and still asserts its queue along with every other native endpoint.
- [Native build 44380254262](https://github.com/k1w1-a0style/musik-player/actions/runs/44380254262) passed all 223 native tests and verified the APK's v2 signature. APK source `a5ece6d25574496b26dad07ee0c1bd1aa43c5945`, SHA-256 `65e27c283bb8811d4cdb21d019b94bb8da30bd42c4119cc55a9466f1bd3ee29d`.
- The first live-device harness missed Android's accessibility busy suffix and treated a finished optional-waveform error as a running task. Corrected the selectors using the recorded UI XML and verified the terminal panel against the exact emulator frame. 220 Python diagnostic tests pass. Both retest requests pin the existing signed APK and changed only harness or documentation paths.
- The exact V6 APK requires GitHub's native runner. The scan diagnostic exercises the Download fixture before and after explicit opt-in, inactive playlist membership, source aliases, malformed covers and playback on API 29/35. Keep the current `main` baseline until acceptance finishes.
- Dependabot replaced #404, #405, #406, #407 and #415 with newer proposals. Active #408 and #416–#421 remain relevant for workflow, Expo/RN platform, Zod and lint-toolchain maintenance. The baseline full npm audit reported 11 moderate findings and zero high or critical. Check the production policy independently and address safe fixes without mixing native SDK upgrades into V6.
- The remote Git transport has read access. The connected API can update existing branch refs but exposes no delete operation. Keep branch heads intact unless authenticated deletion is available.
- ReplayGain remains a separate native audio-effects task. Existing per-track gain and peak metadata are not part of the acknowledged playback contract.
