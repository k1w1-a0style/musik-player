# Tag Edit PR – Review Resolution Checklist

## Scope of this PR

This PR intentionally provides **foundation only**:
- capability model
- validation
- guarded writer interfaces
- safe write orchestration modeling (dry-run)
- safety documentation

It does **not** ship a production-ready MP3/MP4 writer.

## Review topics status

- [x] Capability model stabilized (including missing-URI read=false behavior).
- [x] Error-code mapping fixed (`UnsupportedFormat`, `UnsupportedUri`, `MissingWritePermission`, `WriteNotImplemented`, `InvalidTagData`).
- [x] Device writes are guarded: `file://` only, `content://` remains blocked.
- [x] `applyTagEditToBuffer` supports MP3 ID3v2.3 and a guarded MP4/M4A in-memory writer path.
- [x] Validation retained (trim/undefined, year/position/genre, cover magic bytes).
- [x] Safe write orchestration types and dry-run planner added.
- [x] Backup/temp/atomic/rollback strategy documented as preparation only.

## Intentionally deferred to follow-up PRs

- [x] Safe MP3 in-memory writer implementation (v2.3 output, v2.3/v2.4 input replacement, ext-header/footer handling, guarded unsync behavior).
- [x] Safe MP4/M4A in-memory atom rewrite implementation (guarded subset).
- [ ] Real guarded device writes (after orchestrator is wired with concrete file operations).
- [ ] UI editor integration.

## MP4/M4A review resolution (in-memory)
- Added isolated MP4/M4A in-memory tag editing path for safe atom layouts only.
- Kept MP3 ID3v2.3 writer unchanged.
- Kept file-write orchestration in dry-run/block mode.
- Deferred risky layouts (missing metadata path, largesize, moov-before-mdat resize) to `WriteNotImplemented`.

- Added early MP4/M4A no-op guard so empty drafts return original bytes without requiring metadata hierarchy.
- Safe-layout restrictions remain for actual edits, including blocking moov-resize when later mdat atoms exist.
- Guarded `file://` writes are active; SAF/content writes remain deferred.

## 2026-05 update
- [x] Guarded real `file://` writes enabled with backup/temp/verification/replace flow.
- [x] Added file-write adapter abstraction for testability.
- [x] `content://` safe-write remains intentionally blocked for a dedicated follow-up PR.
