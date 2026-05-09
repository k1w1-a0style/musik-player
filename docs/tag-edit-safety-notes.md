# Tag Edit Safety Notes (Preparation Phase)

## Current policy (this PR)

- No real device file writes are enabled.
- `writeTagsToFile` always throws `WriteNotImplemented`.
- `applyTagEditToBuffer` for `mp3`, `m4a`, and `mp4` throws `WriteNotImplemented`.
- Unsupported containers throw `UnsupportedFormat`.

## Capability model

- `remote` URIs are read-only.
- `content://` requires SAF write permission and a dedicated safe-write flow.
- `file://` writes are intentionally disabled by policy in this PR.
- Missing or unknown URI is unsupported for editing.

## Validation retained

- Tag normalization trims values and converts empty strings to `undefined`.
- Year/track/disc/genre validations remain active.
- Cover payload validation accepts only JPEG/PNG with magic-byte checks.
- `removeCover=true` takes precedence over a provided cover payload.

## Follow-up PR requirements for MP3 writer

A separate PR is required before enabling MP3 writes, including:
- ID3v2.3/v2.4 strategy and frame-size correctness,
- Unicode-safe text/COMM handling,
- APIC add/replace/remove semantics,
- extended header / footer handling,
- unsynchronisation handling,
- frame-preservation policy,
- truncation/corruption safety tests.

## Follow-up PR requirements for MP4/M4A writer

A separate PR is required for atom-level rewrite logic with full safety checks.

## UI behavior requirement

Until writers are implemented, UI must surface `WriteNotImplemented` clearly.
