// Full-library import and metadata refresh can legitimately spend time in native
// MediaLibrary/SAF and tag parsing calls. Keep both flows on one documented budget
// so cancellation/timeout handling stays consistent and tests can override it.
export const DEFAULT_LIBRARY_OPERATION_TIMEOUT_MS = 90_000;

// Read-only native metadata/artwork calls are not cancellable on every Android
// provider. Bound the JS wait, and let callers stop issuing further native reads
// on that worker after a timeout so detached native calls remain capped.
export const DEFAULT_LIBRARY_NATIVE_READ_TIMEOUT_MS = 15_000;

// Manual metadata refresh no longer relies on a tight global hard-timeout to bound
// runtime. A generous soft budget acts only as a final safety net, while a per-track
// timeout (see songMetadataRefresh) isolates individual slow/broken files so a full
// library run can complete instead of ending as a partial scan (e.g. "67 of 83").
export const MANUAL_METADATA_REFRESH_SOFT_BUDGET_MS = 300_000;

// A single track may not block the whole refresh. Slow or broken files are skipped
// as "failed" after this per-track timeout and reported individually.
export const MANUAL_METADATA_REFRESH_PER_TRACK_TIMEOUT_MS = 12_000;
