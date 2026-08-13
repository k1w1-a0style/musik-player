chore(audit): deep scan fixes for SystemAudio modules, scripts & tests

This PR contains an initial wave of stability, robustness, and performance fixes produced by a repo deep-scan against the codex branch.

Key changes:
- modules/expo-system-audio
  - SystemAudioWaveformModule: unified waveform normalization floor, ByteBuffer reuse to reduce allocations, improved cancellation checks.
  - SystemAudioModule: clarified parseTagWriteMaxBytes numeric handling; ensure temp file cleanup; defensive release() calls for MediaMetadataRetriever/MediaExtractor.
- CI: run feature-branch patterns to provide CI feedback for common feature branches (fix/**, feat/**, chore/**, refactor/**, review/**, codex/**)

Validation & How to test:
- Create PR from codex-deep-scan-fixes into codex (this PR's target). CI will run and should exercise lint, typecheck, jest, and native Gradle unit tests for expo-system-audio.
- Run locally: npm ci && npm run lint:ci && npm run typecheck && npm run test:coverage

If CI is green I'll proceed with further fixes and tests on this branch.