// Full-library import and metadata refresh can legitimately spend time in native
// MediaLibrary/SAF and tag parsing calls. Keep both flows on one documented budget
// so cancellation/timeout handling stays consistent and tests can override it.
export const DEFAULT_LIBRARY_OPERATION_TIMEOUT_MS = 90_000;
