# Tag Edit Safety Notes

## Current policy

- Guarded real writes are enabled for supported local Android `file://` MP3/M4A/MP4 audio files.
- The Android TagEditor and write planner enable SAF `content://` writes only for SAF-sourced MP3/M4A/MP4 tracks when the loaded native module exposes the full durable writer/recovery contract.
- The public writer rejects tracks explicitly identified as `media-library` before any native write. A direct caller that supplies an ambiguous `content://` URI without source metadata is not advertised as writable by the planner and is delegated to the native permission/provider checks.
- Text-tag writes, cover add/replace and cover removal use the same guarded native writer for accepted MP3/M4A/MP4 SAF requests.
- Remote, empty, unknown and unsupported containers remain read-only and fail before any write attempt.
- `atomicReplace=false` for SAF and local-file plans; SAF provider truncate/write behavior remains provider-dependent and must be validated on real Android devices before release.

## SAF streaming contract

- JavaScript does **not** transfer the complete audio file for the native SAF writer.
- JavaScript sends only the validated tag draft, changed-field list, target container, size limit and optionally one bounded JPEG/PNG cover payload.
- MP3 rewriting streams audio bytes and keeps only bounded ID3 metadata in memory.
- MP4/M4A rewriting streams non-`moov` atoms and keeps only the bounded `moov` block in memory.
- Native code verifies deletion-intent no-ops by re-reading and rewriting through the native path; JVM/Robolectric covers this production logic but does not prove real provider behavior.
- SAF writes use app-private transaction backup, rollback, restart recovery and post-write byte verification. They do not provide OS-atomic replacement.
- Provider-dependent SAF truncate/write behavior remains a real device risk.

## Safe write orchestration

The orchestration plan models:

- write preconditions,
- URI and capability gates,
- backup strategy,
- temp/staging strategy,
- output verification,
- replace/write expectations,
- rollback viability,
- explicit user-facing reasons.

## URI and capability strategy

- Remote URIs are read-only and return `UnsupportedUri`.
- Missing, empty or unknown URI values are rejected before write attempts.
- Local Android `file://` uses guarded backup, temp, verify and replace flow when the adapter reports safe replace support.
- iOS/web `file://` remains unavailable until a safe replace primitive exists.
- The Android TagEditor/planner requires a SAF source signal, a writable runtime and the full native durable writer contract before enabling `content://` saves.
- The public writer rejects explicit `media-library` provenance with `MissingWritePermission`. Ambiguous direct `content://` calls without source metadata fall through only to native persisted/direct permission and provider-writable checks; this fallback is not an advertised UI capability.
- Old native builds that do not expose write, deletion verification, recovery status and recovery APIs are treated as incomplete and blocked.
- Capability, UI and public-writer gates are aligned for known SAF and MediaLibrary provenance; ambiguous direct API calls remain fail-closed at the native permission layer.

## Backup, verification and rollback concept

For guarded local writes, flow is:

1. never overwrite original directly,
2. create backup,
3. write temp output,
4. validate output,
5. replace target,
6. rollback from backup on failure,
7. cleanup temp/backup artifacts per policy.

For SAF/content writes, the Android native route:

1. recovers pending transactions for the target,
2. checks persisted/direct write permission and provider writable flags,
3. copies the original stream into an app-private durable transaction backup,
4. verifies backup bytes,
5. rewrites to a durable app-private staged file,
6. re-verifies the live original has not changed,
7. writes via `ContentResolver` truncating output,
8. hashes the target after write,
9. rolls back from the app-private backup on detected write/verification failure,
10. keeps unresolved transactions for restart recovery when cleanup or rollback cannot be completed.

## Validation retained

- Tag normalization trims values and converts empty strings to `undefined`.
- Year/track/disc/genre validations remain active.
- AlbumArtist is part of the editable tag model and maps to MP3 `TPE2` / MP4 `aART` where supported.
- Cover payload validation accepts only JPEG/PNG with magic-byte checks and an 8 MiB native cover limit capped by the active file-size limit.
- `removeCover=true` takes precedence over a provided cover payload in the JavaScript planner and invalid mixed native requests fail closed.
- The native file-size limit remains 50 MiB.

## MP3 writer safety boundaries

- MPEG evidence is checked before every edit intent.
- MPEG version, layer, bitrate, sample rate, padding and emphasis are validated.
- The complete first MPEG frame length is checked.
- Missing, invalid or truncated first MPEG frames are fail-closed as invalid data.
- ID3v1/APEv2/Lyrics3 tail metadata remains conservatively blocked for deletion intents.
- The writer streams audio bytes after the ID3 boundary instead of loading the full audio file.
- Bounded ID3 metadata is kept in memory; oversized ID3 metadata fails closed.
- Existing ID3v2.2 tags are not written.
- Existing ID3 unsynchronisation, ID3v2.4 extended headers, ID3v2.4 experimental flags, ID3v2.4 footers, invalid frame IDs, truncated frames and frame sizes above supported bounds remain intentionally unsupported or invalid.

## MP4/M4A writer safety boundaries

- `mdat` payloads remain unchanged.
- Non-`moov` top-level atoms are streamed through unchanged.
- Only a bounded `moov` block is kept in memory.
- Actual edit intent requires an existing `moov/udta/meta/ilst` path.
- `moov` size changes before a later `mdat` remain blocked because sample-offset patching is not implemented.
- Equal-size changes before `mdat` remain allowed.
- Changes when `moov` is after the last `mdat` are allowed for known-safe atom layouts.
- `largesize` atoms, invalid atom sizes, missing required metadata paths and atoms above the supported 32-bit size bounds remain blocked.

## Tag Editor UI gate

- `TagEditor` uses capability + orchestration gates before save UI is enabled.
- No automatic writes on open; writes require explicit confirmation dialog.
- Local Android `file://` tag and cover updates are enabled where the writer supports the container/layout.
- Android SAF MP3/M4A/MP4 text-tag updates, cover add/replace and cover removal are enabled only when the track is SAF-sourced and runtime/native gates pass.
- MediaLibrary-only `content://`, iOS/web file writes, remote URIs, old native builds and unsupported containers remain unavailable in the UI/planner.
- After successful save, in-memory metadata is synchronized for songs, current song, playback queue and queue refs.
- Queue metadata sync also performs best-effort RNTP native metadata updates for queued tracks.
- `removeCover` successful writes clear `cover` and `coverInfo` in UI state.
- After successful save, UI state patch uses normalized tag values to match file output.
- Editor keeps non-Song model form values such as track, disc and comment visible after successful/no-op saves; errors keep user input for correction.
- Cover add/replace/remove remain distinct actions.
- After successful cover replacement, the UI patch may temporarily show the selected picker URI as `cover`/`coverInfo.uri` with `status=embedded`; a later rescan/cache extraction can replace it with a stable embedded-cover URI.
- Exactly one editable TagEditor UI is active; legacy ID3 editor paths were removed.
- Tag writes run exclusively through the public TagWriter path; no alternative save path is supported.

## Limits of proof

- JVM/Robolectric checks production logic, native transactions and rewrite boundaries, but it is not a real SAF provider/device validation.
- Real Android SAF device validation with representative providers remains required before release.
- This PR step must not be represented as producing an APK, AAB, EAS build or device test unless those actions are actually performed separately.
