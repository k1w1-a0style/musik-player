# Tag Edit Safety Notes

## Current policy

- Guarded real writes are enabled for supported local `file://` audio files on Android.
- Android SAF MP3 text-tag writes are enabled only for SAF-sourced `content://` tracks with an existing write grant, supported MP3 layout, temporary verification and native write protection.
- MediaLibrary `content://` tracks without SAF write grant remain read-only.
- SAF cover writes, SAF MP4/M4A writes and unsupported layouts remain unavailable.
- Remote, empty or unknown URIs remain read-only and fail before any write attempt.
- `applyTagEditToBuffer` writes in-memory for:
  - MP3 via ID3v2.3 with strict 28-bit synchsafe payload-size validation before tag allocation/serialization,
  - MP4/M4A via a guarded atom-writer path for known-safe layouts only.
- Unsupported containers throw `UnsupportedFormat`.

## Safe write orchestration

The orchestration plan models:

- write preconditions,
- URI and capability gates,
- backup strategy,
- temp file strategy,
- output verification,
- replace/write expectations,
- rollback viability,
- explicit user-facing reasons.

## URI strategy

- Remote URIs are read-only and return `UnsupportedUri`.
- Missing, empty or unknown URI values are rejected before write attempts.
- Local Android `file://` uses guarded backup, temp, verify and replace flow when the adapter reports safe replace support.
- iOS/web `file://` remains unavailable until a safe replace primitive exists.
- Android SAF MP3 `content://` writes use the native SAF route and require a persisted write grant.
- Non-MP3 SAF formats, SAF cover writes and unsupported SAF layouts stay unavailable.
- Capability and preflight gates are expected to match the writer behavior.

## Backup, verification and rollback concept

For guarded local writes, flow is:

1. never overwrite original directly,
2. create backup,
3. write temp output,
4. validate output,
5. replace target,
6. rollback from backup on failure,
7. cleanup temp/backup artifacts per policy.

For SAF/content writes, atomic replace guarantees can differ by provider. The Android native SAF route therefore uses a guarded temp copy, byte verification, ContentResolver write and rollback attempt for MP3 text-tag writes only.

## Validation retained

- Tag normalization trims values and converts empty strings to `undefined`.
- Year/track/disc/genre validations remain active.
- AlbumArtist is part of the editable tag model and maps to MP3 `TPE2` / MP4 `aART` where supported.
- Cover payload validation accepts only JPEG/PNG with magic-byte checks.
- `removeCover=true` takes precedence over a provided cover payload.

## MP3 writer

- Reads existing ID3v2.3/v2.4 headers, removes full old tag including v2.4 footer, and rewrites a new ID3v2.3 tag in memory.
- Audio bytes after the tag boundary are preserved exactly.
- Existing unsynchronisation flag remains unavailable to avoid unsafe metadata loss.
- APIC payload construction avoids large spread-based intermediate JS arrays.
- Text/COMM payload construction also avoids spread-based intermediate JS arrays.
- Preserved frame IDs are validated with `[A-Z0-9]{4}`; invalid/non-ASCII IDs are rejected with `InvalidTagData`.
- Truncated ID3 preambles are rejected as `InvalidTagData` and not treated as audio.
- Existing ID3v2.4 inputs return original bytes for strict no-op drafts, while actual v2.4 edits remain unavailable.

## MP4/M4A writer

- `applyTagEditToBuffer` routes `m4a/mp4` to the in-memory MP4 atom writer.
- Strict no-op drafts return original bytes before any MP4 structure checks.
- Actual edit intent requires an existing `moov/udta/meta/ilst` path.
- If a tag change would resize `moov` and any top-level `mdat` appears later in file order, the writer returns `WriteNotImplemented` because `stco/co64` patching is not implemented.
- If `moov` is after `mdat`, metadata rewrite is allowed.
- `mdat` bytes are preserved and never rewritten.
- Device writes are enabled for guarded local `file://` paths only; SAF MP4/M4A writes remain unavailable.

## Controlled local file write activation

- `writeTagsToFile(song, draft)` supports guarded real writes for supported Android `file://` URIs.
- Flow: read -> in-memory rewrite -> backup `.bak` -> temp `.tmp` -> basic verification -> replace.
- Adapter capability gate blocks replace early on unsupported platforms before backup/temp creation.
- If backup/temp/verification fails, replace is never attempted.
- If replace fails, rollback from backup is attempted; rollback failure throws `RollbackFailed`.
- Existing-file replace is currently allowed for Android only; iOS remains unavailable until a safe replace primitive exists.
- Source file read failures are normalized to `UnsupportedUri` errors.
- Temp verification read failures are normalized to `VerificationFailed` with best-effort temp cleanup.
- Temp cleanup after successful replace is non-fatal and reported as warning.
- Capability/planner now align with guarded local file write support.

## Android SAF/content MP3 text-tag write activation

- `writeTagsToSafContentUri(song, draft)` supports MP3 text-tag updates for SAF-sourced `content://` tracks on Android.
- The capability gate allows this only for Android + MP3 + `fileInfo.source === 'saf'`.
- The native route checks persisted URI access and provider write flags before writing.
- The native route works through a temporary file, verifies output and then writes through `ContentResolver`.
- SAF cover writes are not part of this route.
- SAF MP4/M4A writes are not part of this route.
- Unsupported containers and unsupported MP3 layouts remain unavailable.

## Tag Editor UI gate

- `TagEditor` uses capability + orchestration gate before save UI is enabled.
- No automatic writes on open; writes require explicit confirmation dialog.
- Local Android `file://` tag and cover updates are enabled where the writer supports the container/layout.
- Android SAF MP3 text-tag updates are enabled when the track was imported from SAF and write access is still available.
- MediaLibrary-only `content://`, SAF cover updates, SAF MP4/M4A updates, iOS/web file writes, remote URIs and unsupported containers remain unavailable in the UI.
- After successful save, in-memory metadata is synchronized for songs, current song, playback queue and queue refs.
- Queue metadata sync also performs best-effort RNTP native metadata updates for queued tracks.
- `removeCover` successful writes clear `cover` and `coverInfo` in UI state.
- After successful save, UI state patch uses normalized tag values to match file output.
- Editor keeps non-Song model form values such as track, disc and comment visible after successful/no-op saves; errors keep user input for correction.
- Cover replacement is active for supported writable local file tracks.
- Cover remove and cover replace remain distinct actions.
- After successful cover replacement, the UI patch may temporarily show the selected picker URI as `cover`/`coverInfo.uri` with `status=embedded`; a later rescan/cache extraction can replace it with a stable embedded-cover URI.
- Exactly one editable TagEditor UI is active; legacy ID3 editor paths were removed.
- Tag writes run exclusively through the public TagWriter path; no alternative save path is supported.
