# Tag Edit Safety Notes (Preparation Phase)

## Current policy (this PR)

- No real device file writes are enabled.
- `writeTagsToFile` always throws `WriteNotImplemented`.
- `applyTagEditToBuffer` writes in-memory for:
  - MP3 via ID3v2.3 (with strict 28-bit synchsafe payload-size validation before tag allocation/serialization),
  - MP4/M4A via a guarded atom-writer path for known-safe layouts only.
- `m4a`/`mp4` use a guarded in-memory writer for safe atom layouts only; unsafe layouts still throw `WriteNotImplemented`.
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


## MP3 in-memory writer (new in this PR)

- Reads existing ID3v2.3/v2.4 headers, removes full old tag (including v2.4 footer), and rewrites a new ID3v2.3 tag in-memory only.
- Audio bytes after tag boundary are preserved exactly.
- Existing unsynchronisation flag is currently blocked with `WriteNotImplemented` to avoid unsafe metadata loss.
- `writeTagsToFile` remains blocked; no SAF/device write path is activated.

- APIC payload construction avoids large spread-based intermediate JS arrays.
- Text/COMM payload construction also avoids spread-based intermediate JS arrays.
- Preserved frame IDs are validated (`[A-Z0-9]{4}`); invalid/non-ASCII IDs are rejected with `InvalidTagData`.

- Truncated ID3 preambles (`ID3` with <10 bytes) are rejected as `InvalidTagData` and not treated as audio.
- Existing ID3v2.4 inputs return original bytes for strict no-op drafts, while actual v2.4 edits remain blocked (`WriteNotImplemented`).

## 2026-05 MP4/M4A in-memory writer safety update
- `applyTagEditToBuffer` now routes `m4a/mp4` to an in-memory MP4 atom writer only.
- Strict no-op drafts (`{ tags: {} }`, undefined-only tags, no cover/removeCover intent) return original bytes before any MP4 structure checks.
- For actual edit intent, scope is intentionally narrow: requires existing `moov/udta/meta/ilst` path, otherwise `WriteNotImplemented`.
- If a tag change would resize `moov` and any top-level `mdat` appears later in file order, writer throws `WriteNotImplemented` (no `stco/co64` patching yet).
- If `moov` is after `mdat`, metadata rewrite is allowed.
- `mdat` bytes are preserved and never rewritten.
- Device writes are still blocked (`writeTagsToFile` remains `WriteNotImplemented`).

## 2026-05 controlled file:// write activation
- `writeTagsToFile(song, draft)` now supports guarded real writes for `file://` URIs only.
- Flow: read -> in-memory rewrite (`applyTagEditToBuffer`) -> backup `.bak` -> temp `.tmp` -> basic verification -> replace.
- If backup/temp/verification fails, replace is never attempted.
- If replace fails, rollback from backup is attempted; rollback failure throws `RollbackFailed`.
- `content://` (SAF) remains blocked with `MissingWritePermission`.
- Remote/unknown URIs remain blocked with `UnsupportedUri`.
