# PR #313 isolated CI verification

This temporary verification branch is based on `fe8ece805644419b16c247acdfe50810d413aef9`.

Purpose: run the normal read-only CI on a separate pull-request ref because the `codex` push workflow is blocked by a stale in-progress runner/concurrency slot.

The verification branch contains no additional production-code changes. This file exists only to create a reviewable diff and must not be merged into `codex`.

No APK, AAB or EAS build is part of this verification.
