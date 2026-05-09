# Tag Edit Safety Notes (Preparation Phase)

## Current policy (this PR)

- No real device file writes are enabled.
- `writeTagsToFile` always throws `WriteNotImplemented`.
- `applyTagEditToBuffer` for `mp3`, `m4a`, and `mp4` throws `WriteNotImplemented`.
- Unsupported containers throw `UnsupportedFormat`.
- New orchestration logic is **dry-run simulation only**.

## Safe write orchestration (prepared, not activated)

The orchestration plan now models:
- write preconditions,
- permission gates,
- backup strategy,
- temp file strategy,
- atomic replace expectations,
- rollback viability,
- explicit blocking reasons.

No plan step performs a real write, delete, or replace operation.

## URI strategy

- `remote` URIs are read-only and blocked (`UnsupportedUri`).
- missing/unknown URI is blocked (`UnsupportedUri`).
- `content://` requires SAF write permission, is high-risk, and may not guarantee atomic replace (`MissingWritePermission`, `WriteNotImplemented`).
- `file://` is modeled with backup+temp+atomic replace requirements, but still blocked by policy (`WriteNotImplemented`).

## Backup + rollback concept

Before any future real write, flow must be:
1. never overwrite original directly,
2. create backup,
3. write temp output,
4. validate output,
5. replace target,
6. rollback from backup on failure,
7. cleanup temp/backup artifacts per policy.

For SAF/content URIs, rollback guarantees may be limited and must remain guarded.

## Validation retained

- Tag normalization trims values and converts empty strings to `undefined`.
- Year/track/disc/genre validations remain active.
- Cover payload validation accepts only JPEG/PNG with magic-byte checks.
- `removeCover=true` takes precedence over a provided cover payload.

## Follow-up PR requirements

Separate PRs are still required for:
- production MP3 ID3 rewrite implementation,
- production MP4/M4A atom rewrite implementation,
- enabling guarded real device writes,
- UI editor integration.
