# Tag Edit PR – Review Resolution Checklist

## Scope of this PR

This PR intentionally provides **foundation only**:
- capability model
- validation
- guarded writer interfaces
- safety documentation

It does **not** ship a production-ready MP3/MP4 writer.

## Review topics status

- [x] Capability model stabilized (including missing-URI read=false behavior).
- [x] Error-code mapping fixed (`UnsupportedFormat`, `UnsupportedUri`, `MissingWritePermission`, `WriteNotImplemented`).
- [x] Device writes remain blocked (`writeTagsToFile` => `WriteNotImplemented`).
- [x] `applyTagEditToBuffer` for mp3/m4a/mp4 now intentionally disabled (`WriteNotImplemented`).
- [x] Validation retained (trim/undefined, year/position/genre, cover magic bytes).

## Intentionally deferred to follow-up PRs

- [ ] Safe MP3 writer implementation (v2.3/v2.4 strategy, Unicode-safe encoding, COMM/APIC correctness, ext-header/footer/unsync handling).
- [ ] Safe MP4/M4A atom rewrite implementation.
- [ ] Atomic file write orchestration (backup/temp/validate/replace/rollback).
- [ ] UI editor integration.
