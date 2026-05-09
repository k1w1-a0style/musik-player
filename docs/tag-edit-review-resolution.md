# Tag Edit PR – Review Resolution Checklist

This checklist summarizes the technical review points that were addressed in the current PR history.

## Safety / Write Policy

- [x] No direct on-device writes enabled.
- [x] `writeTagsToFile` remains blocked via `WriteNotImplemented`.
- [x] MP4/M4A write path remains blocked (`WriteNotImplemented`).

## Capability Model

- [x] URI type classification (`file`, `content`, `remote`, `unknown`).
- [x] Container support classification (`mp3`, `m4a`, `mp4`, `unsupported`).
- [x] Explicit permission/unsupported URI guard (`ensureTagEditWriteAllowed`) with typed errors.

## Validation

- [x] Tag normalization (trim + empty -> `undefined`).
- [x] Year/track/disc/genre validation.
- [x] Cover validation with JPEG/PNG magic-byte checks.

## MP3 In-Memory ID3v2.3

- [x] Text frame serialization with frame-id validation.
- [x] COMM frame serialization.
- [x] APIC frame serialization.
- [x] Draft-to-tag build path.
- [x] Merge path for existing/no-existing ID3 tags.
- [x] Preservation of unknown existing frames during merge.
- [x] Truncated existing-tag rejection.

## Tests

- [x] Capability, validation, and writer suites implemented and passing.
- [x] Added payload-level checks for COMM/APIC.
- [x] Added typed error-code assertions for permission vs unsupported URI cases.

## Documentation

- [x] Safety notes for current constraints and future atomic-write architecture.

## Remaining intentional gaps (not part of this PR scope)

- [ ] Real device file writes with atomic backup/replace/rollback orchestration.
- [ ] MP4/M4A atom rewrite implementation.
- [ ] UI editor wiring.
