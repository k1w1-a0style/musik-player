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
- [x] Device writes remain blocked (`writeTagsToFile` => `WriteNotImplemented`).
- [x] `applyTagEditToBuffer` now supports MP3 in-memory ID3v2.3 rewriting only; `m4a`/`mp4` stay `WriteNotImplemented`.
- [x] Validation retained (trim/undefined, year/position/genre, cover magic bytes).
- [x] Safe write orchestration types and dry-run planner added.
- [x] Backup/temp/atomic/rollback strategy documented as preparation only.

## Intentionally deferred to follow-up PRs

- [x] Safe MP3 in-memory writer implementation (v2.3 output, v2.3/v2.4 input replacement, ext-header/footer handling, guarded unsync behavior).
- [ ] Safe MP4/M4A atom rewrite implementation.
- [ ] Real guarded device writes (after orchestrator is wired with concrete file operations).
- [ ] UI editor integration.

## MP4/M4A review resolution (in-memory)
- Added isolated MP4/M4A in-memory tag editing path for safe atom layouts only.
- Kept MP3 ID3v2.3 writer unchanged.
- Kept file-write orchestration in dry-run/block mode.
- Deferred risky layouts (missing metadata path, largesize, moov-before-mdat resize) to `WriteNotImplemented`.
