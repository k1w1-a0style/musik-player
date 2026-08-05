# Pre-Build Exhaustive Hardening Gate — 2026-08-05

## Baseline

- Repository: `k1w1-a0style/musik-player`
- Base branch: `codex`
- Exact baseline SHA: `8af28a768ceb90aeaaffb68e5948b0ccb0d5facb`
- Tracking issue: #234
- Dependency/supply-chain tracker: #319

This branch exists only for a repository-wide pre-build deep scan and direct fixes. The baseline SHA is not approved for packaging.

## Non-negotiable boundary

Until the hardening gate is independently clean:

- no APK, AAB or EAS build;
- no emulator or device installation;
- no deployment;
- no Preview or Production packaging;
- do not enable or bypass the cloud-build kill switch;
- do not modify `main`;
- keep the pull request in Draft;
- do not merge.

## Required work

Perform repeated repository-wide review passes and directly fix every confirmed P0, P1, P2 and P3 issue. Each fix must include adjacent-call-site review and deterministic regression coverage.

Critical areas:

1. Waveform source identity, collision resistance, cache migration, index/payload crash consistency, clear/write races, capacity and restart.
2. SAF/tag-write transaction journals, receipts, scope migration, JS/native-only evidence, public status, operation-ID reuse, acknowledgement order, compaction and startup recovery.
3. Native queue truth, hydration, current-track/queue persistence, concurrent mutation, supersede/ABA/cancellation, restart and fail-closed readiness.
4. TrackPlayer setup/options, background service, notification/lockscreen capabilities and unknown native state handling.
5. Native metadata, artwork, palette, waveform and backfill lanes, cache identity, timeout/retry/cancellation and leak prevention.
6. Workflow security, untrusted inputs, action pinning, permissions, secrets, artifacts, writeback/autofix and build gates.
7. Android package/profile/permission separation and logging redaction.
8. All entries in `security/code-complexity-baseline.json`, dead code, duplicate logic, stale mocks/tests/re-exports and architecture ownership.
9. Full dependency and supply-chain analysis for #319 using coherent supported compatibility paths only. No forced audit fix, downgrade or isolated major update.

## Confirmed starting findings

- A 32-bit FNV waveform `sourceKey` is currently used as the persisted identity. Add an independent versioned full-source fingerprint and fail closed on mismatch/collision.
- Waveform payload and index writes are not a single recoverable contract. Prevent permanently unreachable payloads and make corrupt/missing indexes reconstructable or safely cleanable.
- Add deterministic tests for intentional hash collision, legacy entries, corrupt fingerprints/indexes, payload-success/index-failure, clear/write races, 79/80/81 capacity and restart/module reset.

## Mandatory non-packaging gates

- reproducible lockfile install;
- source NUL-byte gate;
- TypeScript typecheck;
- complete Jest suite and coverage gate;
- lint;
- complexity gate without weakening the baseline;
- current audit/policy gate;
- Expo config gate;
- Android manifest/permission gate;
- Android prebuild diff only, without packaging;
- JDK 17 / Gradle / Kotlin compilation;
- actual native JVM/Robolectric/JUnit execution;
- workflow security/configuration tests.

## Completion standard

Before declaring the task complete:

1. run two separate full self-review passes on the final head;
2. fix all confirmed findings from both passes;
3. document exact baseline and final SHAs;
4. include a finding table with severity, cause, impact, fix and tests;
5. document every migration and remaining upstream blocker honestly;
6. explicitly confirm that no packaging, emulator, device or deployment action occurred;
7. leave the pull request Draft and unmerged.
