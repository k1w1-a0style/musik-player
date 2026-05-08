# Repository working notes

- Use the branch explicitly requested by the user or the current PR base branch.
- Current development/test target is usually `codex`.
- Use `main` only for finalized, reviewed changes.
- Codex Cloud may use a local sandbox branch named `work`; do not confuse that with the PR base branch.
- Do not infer the intended target branch from workflow examples, allowlist regexes, or local sandbox branch names.
- Do not run `npm audit fix --force`.
- Keep `newArchEnabled=false` while `react-native-track-player@4.1.2` is used.
