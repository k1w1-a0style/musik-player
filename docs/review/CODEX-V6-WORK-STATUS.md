# K1W1 Music V6

## GitHub and baseline

- Baseline `d3ac70918b9ec83f579328f4e725a35acceb371f`. Fast-forwarded `main` from `b62b91b59c7400fd310a5db8fcbf9fc6444ff393` and independently verified both remote heads.
- Baseline CI run [44346716771](https://github.com/k1w1-a0style/musik-player/actions/runs/44346716771) passed quality, native and security jobs. Its exact-preview UI job was skipped.
- Initial inventory 47 branches. Of 45 cleanup candidates, 25 were already reachable from the baseline and 20 had independent history. The independent histories consist of earlier QA and evidence workflows, an offline V5 draft, and dependency proposals.
- `K1W1_V6_Git_Archiv_2026-11-18.bundle` contains the complete history and original names of all 47 branches, plus tags for the V6 baseline and pre-sync main. A fresh repository imported the bundle, passed `git fsck --full` and matched all 47 HEADs. SHA-256 `44f78b6da9601c8ed01023a3798da4d142a520235c177ebec32af156ecde6457`.

## Implemented

- Android read permission no longer selects MediaStore. The explicit device-wide option defaults off for new and existing settings. Manual and automatic scans use the same selection and the saved records remain recoverable.
- Active scope applies to tracks, albums, artists, genres, favorites and playlist views. Verified overlapping folder aliases preserve the stored track ID and let the view use a selected source's URI. An unreadable source and a confirmed absent file remain distinct.
- Backup files accept the additional optional preference, including older backups that omit it. Playlist memberships and favorites stay persisted when a source is removed.

## Evidence and next work

- Three focused regressions reproduced the source-selection and visibility errors at baseline. Focused integrated source, backup, playlist and import checks passed 13 suites / 151 tests before the URI alias follow-up.
- Full local gates and exact Android API 29/35 preview acceptance still pending. Keep the current `main` baseline until acceptance finishes.
- Dependabot replaced #404, #405, #406, #407 and #415 with newer proposals. Active #408 and #416–#421 remain relevant for workflow, Expo/RN platform, Zod and lint-toolchain maintenance. The baseline full npm audit reported 11 moderate findings and zero high or critical. Check the production policy independently and address safe fixes without mixing native SDK upgrades into V6.
- The remote Git transport has read access. The connected API can update existing branch refs but exposes no delete operation. Keep branch heads intact unless authenticated deletion is available.
