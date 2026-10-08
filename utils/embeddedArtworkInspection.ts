import SystemAudio, { type EmbeddedArtworkInspection } from 'expo-system-audio';

/** Preserve the legacy fulfilled-null contract without confirming skipped work. */
export const inspectEmbeddedArtwork = async (uri: string): Promise<EmbeddedArtworkInspection> => {
  try {
    if (typeof SystemAudio.inspectEmbeddedArtwork === 'function') return await SystemAudio.inspectEmbeddedArtwork(uri);
    // Older JS facades/mocks have no checked API. A native read that resolves
    // normally keeps its historical no-artwork result; a rejection is retryable.
    return { checked: true, artwork: await SystemAudio.extractEmbeddedArtwork(uri) ?? null };
  } catch {
    return { checked: false, artwork: null };
  }
};
