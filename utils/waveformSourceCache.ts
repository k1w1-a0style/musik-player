import type { Song } from '../types/Song';
import { getCachedWaveform, setCachedWaveform } from './waveformCache';
import { getCompatibleWaveformSourceIdentities } from './waveformGenerator';
import type { SongWaveform } from './waveformTypes';

/** Reuse finalized v6 shapes without decoding them again after duration backfill. */
export const getCachedWaveformForSong = async (song: Song | null | undefined): Promise<SongWaveform | null> => {
  const [identity, ...legacyIdentities] = getCompatibleWaveformSourceIdentities(song);
  const current = await getCachedWaveform(identity);
  if (current?.source === 'native') return current;
  for (const legacyIdentity of legacyIdentities) {
    const legacy = await getCachedWaveform(legacyIdentity);
    if (legacy?.source !== 'native') continue;
    const migrated = { ...legacy, ...identity };
    // Memory is published immediately; slow or failing disk writes must not
    // delay displaying an already decoded shape.
    void setCachedWaveform(migrated, legacyIdentity).catch(() => undefined);
    return migrated;
  }
  return null;
};
