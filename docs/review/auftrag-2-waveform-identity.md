# Waveform source identity, Auftrag 2

The stored waveform payload is still version 6 and its fingerprint prefix remains
`wf6:`. `getWaveformCanonicalIdentity` retains the exact existing length-prefixed
layout when no physical source revision is known. Existing duration-layout cache
entries therefore remain readable without changing their recorded PCM points.

If `Song.fileInfo.modificationTime` is a positive finite number or
`Song.fileInfo.contentHash` is nonblank, the canonical layout appends three
length-prefixed fields: `physical-v1`, the provider modification time (or `0`),
and the trimmed content hash (or an empty string). Changing either revision
invalidates the identity even if song ID, URI, byte size and import time are
unchanged. Title, artist, cover, derived duration and audio-info backfill do not
change this identity.

Every duration-compatibility candidate preserves the physical suffix. A source
with a known revision never falls back to an unrevisioned older waveform. An old
unrevisioned source that gains its first trustworthy revision is analyzed once
again; the older immutable payload is retained until ordinary cache retirement.
This avoids claiming that a waveform belongs to a file whose physical revision
was never checked.

`LibraryWaveformPreloadIndex` tracks these canonical revisions and dirty pending
entries. It cancels obsolete idle work on a physical change, retains work during
metadata-only backfill, and hashes only changed physical sources. Disabled,
background or metadata-blocked preloaders do not visit the library at all.
The cache keeps a manifest map and an aggregate byte count, writes a new manifest
only when its contents change, and retains serial mutation, payload verification,
byte budgets, restart recovery and delayed-deletion safeguards.

Fresh focused verification after the physical-revision change: 26 suites,
263 tests passed. These include same-URI/same-size mtime and hash changes in the
source generator, legacy/current cache, pending index, foreground late-result
handling and native-cancellable idle decoder lifecycle. Cover bass uses the
central 500 ms progress provider, while its existing native animation still
interpolates between samples and resets on pause/disable.

Reproduce the JS measurements with Node 22:

```sh
node scripts/benchmarks/waveformPerformance.cjs --revision dad2af1d --output docs/review/auftrag-2-waveform-before.json
node scripts/benchmarks/waveformPerformance.cjs --output docs/review/auftrag-2-waveform-after.json
```

Both runs use revision-bearing immutable Song fixtures and real waveform/cache
serializers. The reference code is read from Git, not copied into production.
React effects and native storage are isolated boundaries. These measurements
show synchronous JS work, lookup cost and exact serialized payload/manifest
bytes; they do not measure Android decoder time, process RAM, React commit time,
scroll jank or visible animation on the A50. Host contention affects medians.
