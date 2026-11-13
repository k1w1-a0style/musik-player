# Dependency maintenance, 13 November 2026

The candidate lock upgrades Expo SDK 57 patch packages and pins node-forge 1.4.3, replacing 1.4.0. The 1.4.3 registry package passed all 142 existing Node/OpenSSL and Forge regression cases across its three entry points. Its complete npm payload is fingerprinted in the existing tooling integrity policy; the braces protections and shadow-file checks remain in place. The expired Forge exception and its obsolete effect graph are removed, rather than extended.

The source of `MediaLibraryModule.kt` in expo-media-library 57.0.6 is byte-identical to 57.0.5 (SHA-256 `e4363128600a8a0a2e0d545b619e1d39b486222e284bd6f9c8e145b0754d3212`). The existing source-built Android audio read permission patch therefore retains its unchanged source and patched fingerprints.

The online npm audit of the proposed lock reported zero critical, zero high and three moderate findings, rooted in minimatch via Expo fingerprint tooling. This is a point-in-time result, not a security exception or proof about future advisories. Exact-lock installation, Expo compatibility, Android build and device validation remain required on the resulting commit.
