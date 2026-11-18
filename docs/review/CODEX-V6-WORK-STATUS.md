# K1W1 Music V6

## GitHub and baseline

- Baseline `d3ac70918b9ec83f579328f4e725a35acceb371f`. Fast-forwarded `main` from `b62b91b59c7400fd310a5db8fcbf9fc6444ff393` and independently verified both remote heads.
- Baseline CI run [44346716771](https://github.com/k1w1-a0style/musik-player/actions/runs/44346716771) passed quality, native and security jobs. Its exact-preview UI job was skipped.
- Initial inventory 47 branches. Of 45 cleanup candidates, 25 were already reachable from the baseline and 20 had independent history. The independent histories consist of earlier QA and evidence workflows, an offline V5 draft, and dependency proposals.
- `K1W1_V6_Git_Archiv_2026-11-18.bundle` contains the complete history and original names of all 47 branches, plus tags for the V6 baseline and pre-sync main. A fresh repository imported the bundle, passed `git fsck --full` and matched all 47 HEADs. The persisted file was downloaded and matched byte for byte. SHA-256 `44f78b6da9601c8ed01023a3798da4d142a520235c177ebec32af156ecde6457`.
- The initial 47 branches became 48 after Dependabot replaced its proposals. [Archive run 44401218981](https://github.com/k1w1-a0style/musik-player/actions/runs/44401218981) verified and removed the 39 archived QA and backup refs. Independent remote inspection confirmed nine remaining branches, 14 exact archive tags under `archive/v6/2026-11-18/` and the permanent `baseline/v6-pre-repair-2026-11-18` tag. The one-time workflow was removed after the verified cleanup.

## Implemented

- Android read permission no longer selects MediaStore. The explicit device-wide option defaults off for new and existing settings. Manual and automatic scans use the same selection and the saved records remain recoverable.
- Active scope applies to tracks, albums, artists, genres, favorites and playlist views. Verified overlapping folder aliases preserve the stored track ID and let the view use a selected source's URI. An unreadable source and a confirmed absent file remain distinct.
- Backup files accept the additional optional preference, including older backups that omit it. Playlist memberships and favorites stay persisted when a source is removed.
- Incremental SAF and MediaStore import defer native artwork. The 16-file regression confirms that corrupt artwork cannot hold up base import. Folder change events use selected document trees where the provider sends notifications. Startup and foreground scans also cover providers without notifications.
- Row progress and the header use the existing library and waveform receipts. Work is row-scoped, and the activity sheet provides source access, affected tracks and reasons, and targeted waveform retry.
- Playback failures carry a native track ID and platform error code. Waveform and artwork work remain optional. Optional analysis yields to playback. Audio info and cover retries are bounded and revision-aware. Native waveform previews sample 24 short windows for long mixes and carry a separate cache marker.
- Playlist play buttons use the active source list. M3U/M3U8 export still uses the saved playlist membership. Updated files are grouped in the source, UI, audio and verification commits.

## Verification

- Focused source, storage and playlist checks passed 18 suites / 440 tests. Focused UI checks passed 16 suites / 198 tests. Focused playback and waveform checks passed 11 suites / 188 tests.
- Final local Jest run passed 458 suites / 4,426 tests. TypeScript, ESLint, complexity and source-byte gates passed. Expo's offline check matched the bundled versions; its online lookup timed out locally.
- Production npm audit policy passed with 3 moderate findings and zero high or critical. The generated Android permission manifest and 223 Python diagnostic tests passed.
- The [first native run](https://github.com/k1w1-a0style/musik-player/actions/runs/44376947741) compiled and packaged the Android candidate. Its exact dispatch allowlist test caught the new SAF observer entry point. The allowlist now includes that method and still asserts its queue along with every other native endpoint.
- [Native build 44380254262](https://github.com/k1w1-a0style/musik-player/actions/runs/44380254262) passed all 223 native tests and verified the APK's v2 signature. APK source `a5ece6d25574496b26dad07ee0c1bd1aa43c5945`, SHA-256 `65e27c283bb8811d4cdb21d019b94bb8da30bd42c4119cc55a9466f1bd3ee29d`.
- Recorded Android UI frames exposed test-harness mismatches for the accessibility busy suffix, an already finished optional-waveform error, an unacknowledged detail tap, and optional MediaStore artist metadata on API 29. The corrected harness requires exact search text, the app-owned title card and a real empty state. APK bytes stayed identical throughout these retests.
- [Android 15 release acceptance 44384085365](https://github.com/k1w1-a0style/musik-player/actions/runs/44384085365) confirmed the exact APK hash, 16 integration scenarios and 36 layout cases at 320 dp. The [Android 15 scan job](https://github.com/k1w1-a0style/musik-player/actions/runs/44400571750/job/135142278476) and [Android 10 scan job](https://github.com/k1w1-a0style/musik-player/actions/runs/44402425091/job/135148797299) passed against the same signed APK and source commit.
- Both scan receipts show 16 of 16 tracks on the first import, 16 unchanged on repeat, a Download track visible only through explicit device-wide selection, stable IDs after source changes, a retained two-track playlist, and native playback of all 16 tracks. The temporarily inaccessible folder produced one honest read warning while all 33 source entries remained accounted for. The receipts include last-track visibility above the mini-player at 200% font size.
- [CI 44402425131](https://github.com/k1w1-a0style/musik-player/actions/runs/44402425131) passed quality, native, dependency security and the required release policy on `66d14eb442b6aad6ab72138ec5d42f628b48c61c`. The final work-status update is documentation-only. Differences from the APK source are confined to retest scripts, evidence and diagnostic workflow configuration.

## Follow-up

- Dependabot replaced #404, #405, #406, #407 and #415 with newer proposals. Active #408 and #416–#421 remain relevant for workflow, Expo/RN platform, Zod and lint-toolchain maintenance. The baseline full npm audit reported 11 moderate findings and zero high or critical. Check the production policy independently and address safe fixes without mixing native SDK upgrades into V6.
- The device evidence comes from isolated API 29 and 35 emulators. Physical Samsung storage providers and hour-long mixes remain useful real-device checks. Malformed artwork is present on two playback fixtures. The host regression separately verifies that artwork failures cannot interrupt base import.
- ReplayGain remains a separate native audio-effects task.
