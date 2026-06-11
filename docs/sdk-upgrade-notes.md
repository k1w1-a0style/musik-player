# SDK Upgrade Notes: FileSystem Legacy Surface

## Round 8.5 scope

This note inventories the current `expo-file-system/legacy` surface so future Expo SDK upgrades can start from a known map. It does **not** migrate to the newer `expo-file-system` API and does **not** claim the risk is solved.

## Why legacy is still used

The app still depends on the legacy FileSystem entrypoint because several production flows need async helpers that are already validated in the current runtime:

- SAF directory selection and SAF folder scanning through `StorageAccessFramework`.
- Base64 file reads for ID3/MP4 cover and metadata parsing.
- Guarded tag-write adapter primitives for backup, temp writes, replace, delete, and verification.
- Cover cache writes, directory fallback handling, and stale cover cleanup.

The non-legacy `expo-file-system` import is present only as a compatibility/fallback surface in selected modules, or for the newer `File` constructor fallback in the ID3 parser. Do not change these imports blindly during an SDK bump; verify API availability and behavior first.

## Current import inventory

| Area | Module | Current FileSystem usage | Why it exists |
| --- | --- | --- | --- |
| Import / refresh | `utils/mediaLibraryImport.ts` | `StorageAccessFramework.readDirectoryAsync` from `expo-file-system/legacy` | Scans configured Android SAF folders and builds import candidates alongside MediaLibrary assets. |
| Scan-folder picker | `hooks/useLibraryScanFolderActions.ts` | `StorageAccessFramework.requestDirectoryPermissionsAsync` from `expo-file-system/legacy` | Opens the Android directory permission picker and persists selected scan folders. |
| TagWriter backup/temp/verify | `utils/tagFileWriteAdapter.ts` | `readAsStringAsync`, `writeAsStringAsync`, `copyAsync`, `deleteAsync`, `getInfoAsync`, `EncodingType.Base64` from `expo-file-system/legacy` | Bridges guarded `file://` tag writes to byte reads/writes, backup copy, temp replace, cleanup, and file-info verification. |
| Cover extraction / parsing | `utils/id3Parser.ts` | `readAsStringAsync`, `getInfoAsync`, `EncodingType.Base64` from `expo-file-system/legacy`; `File` fallback from `expo-file-system` | Reads bounded head/tail byte windows for ID3/MP4 metadata and cover extraction without loading large files unless the guarded fallback allows it. |
| Cover cache | `utils/coverCache.ts` | `makeDirectoryAsync`, `writeAsStringAsync`, `documentDirectory`, `cacheDirectory`, `getInfoAsync` from `expo-file-system/legacy`; directory/write fallbacks from `expo-file-system` | Writes base64 image covers into app storage and chooses a stable document/cache base directory. |
| Cover cache cleanup | `utils/coverCacheCleanup.ts` | namespace import from `expo-file-system/legacy`; fallback namespace import from `expo-file-system`; uses `documentDirectory`, `cacheDirectory`, `getInfoAsync`, `readDirectoryAsync`, `deleteAsync` | Enumerates cached cover files in the cache directory and deletes orphaned files while tolerating SDK/runtime differences in directory constants and cleanup helpers. |

Tests mock both `expo-file-system/legacy` and selected `expo-file-system` fallback fields in the existing Jest suites for import, cover cache, tag writes, and MusicContext persistence/hydration. Those tests are guard coverage for current import paths; they are not a replacement for device smoke testing after an SDK upgrade.

## Config gates before platform/runtime upgrades

- `newArchEnabled=false` is intentional while `react-native-track-player@4.1.2` is used. Do not flip it during an SDK or dependency bump without a dedicated New Architecture PR and Android playback/background/notification smoke coverage.
- `tsconfig.json` no longer carries `ignoreDeprecations`; future TypeScript deprecation warnings should be handled explicitly instead of being globally suppressed.

## SDK upgrade risks to keep visible

- Legacy helpers may be removed, relocated, renamed, or stop being exported from `expo-file-system/legacy`.
- SAF permission and `content://` directory traversal behavior may change independently from local `file://` helpers.
- Base64 partial reads (`length` / `position`) are critical for bounded ID3/MP4 parsing; behavioral drift could cause missed covers, excessive memory use, or parse failures.
- Directory constants (`documentDirectory`, `cacheDirectory`) may move or differ between legacy and non-legacy entrypoints; cover cache writes and cleanup depend on stable values.
- `readDirectoryAsync` must remain available through the legacy and/or fallback import used by cover cache cleanup; otherwise orphan enumeration could be silently skipped or broken.
- Copy/delete semantics are part of the guarded tag-write rollback story; unsafe replace or cleanup behavior could risk original audio files.
- File info shape (`exists`, `size`, `isDirectory`) is used for verification, large-file blocking, and directory rejection.

## Required automated smoke checks before an SDK upgrade merge

Run the normal quality gates and ensure the existing focused tests covering these flows remain green:

- MediaLibrary and SAF import tests for directory traversal, skipped assets, dedupe, and timeout/cancellation behavior.
- Cover cache and cover cleanup tests for base directory selection, write fallback, size cap, stale cleanup behavior, and `readDirectoryAsync` availability for orphan enumeration.
- ID3 parser tests for bounded reads, MP3/MP4 cover extraction, and failure fallbacks.
- TagWriter and tag-file-write-adapter tests for `file://` write planning, backup/temp/verify behavior, unsupported URI handling, and cleanup.
- Storage and MusicContext hydration/persistence tests for persisted queue and cover metadata compatibility.

## Manual smoke flows after an SDK upgrade

Perform these on a real Android device or emulator before release:

1. Music import from MediaLibrary.
2. Music import from a SAF scan folder.
3. Cover extraction and display after import.
4. Tag edit on a supported local `file://` track with backup/temp/verify completing successfully.
5. Cover Replace on a supported local `file://` track.
6. Cover Remove on a supported local `file://` track.
7. Confirm `content://` tracks remain read-only for tag writes and cover changes.
8. Confirm large files remain blocked before write attempts.
9. Confirm cache/temp cleanup remains stable after successful write, failed write, and app restart.

## Do not treat this as fixed

This document is only a maintenance map. A future SDK migration still needs a dedicated PR with device verification, rollback review, and explicit comparison of legacy and replacement API behavior.
