# Tag Edit Safety Notes (Preparation Phase)

This document captures current constraints for tag editing in the Expo SDK 54 app.

## URI handling

- `https://` / `http://` (remote demo URLs): **read-only**, never editable.
- `content://` (Android SAF / provider-backed): potentially editable only when:
  - persistable SAF write permission exists,
  - provider supports write,
  - rewrite strategy is compatible with provider semantics.
- `file://`: potentially editable only with atomic temp-write + validate + replace flow.
- Unknown URI schemes: unsupported.

## Container handling

- `mp3`: preparation supported (validation + frame planning), full rewrite still blocked.
- `m4a` / `mp4`: read/preparation supported, write path intentionally blocked.
- Others: unsupported.

## Current write policy

- No real device file writes are enabled.
- `writeTagsToFile` is intentionally disabled.
- `applyTagEditToBuffer` for MP3/MP4/M4A throws `WriteNotImplemented`.

## Planned safe write architecture (future)

1. Resolve and verify write capability (+ explicit user consent in UI).
2. Read source bytes and parse current metadata.
3. Build rewritten bytes in memory.
4. Validate rewritten bytes (parseability + expected fields).
5. Write to temporary location.
6. Validate temp file again.
7. Replace original atomically where possible.
8. Roll back on any failure.

## Known SAF caveats

- Atomic replace is not guaranteed for all providers.
- Some providers support write-stream overwrite but not rename/replace.
- For non-atomic providers, future UI must show warning and offer copy-based strategy.
