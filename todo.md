# K1W1 Musikplayer – Arbeitsplan TODO

Status-Legende: ✅ fertig & getestet · 🔄 in Arbeit · ⏳ offen · 📱 implementiert, Android-Geräteprüfung offen

Verifikation vor jedem Abschluss: `typecheck` + `lint:ci` + `jest --runInBand`.
Reihenfolge folgt dem Deep-Scan-Arbeitsplan (Phasen 1–8).

---

## Phase 1 – Seek/Scrubbing-Performance ✅
- ✅ Drag-Scrubbing (PanResponder) mit optimistischem Thumb, kein Rubber-Band
- ✅ Dedizierte Seek-Lane (last-value-wins), nicht hinter Queue-Rebuilds
- ✅ Tests (seekController, Scrub-Math)

## Phase 2 – Metadaten-Refresh stabilisieren ✅
- ✅ Per-Track-Timeout statt globalem Abbruch (kein „67/83"-Teilscan mehr)
- ✅ Soft-Budget statt hartem 90s-Timeout
- ✅ Backfills pausieren während manuellem Refresh
- ✅ Fehlerliste (errorDetails: uri + Grund)
- ✅ Live-Fortschritt mit Zählern (x/y · aktualisiert · übersprungen · fehlgeschlagen)
- ✅ Persistenter Operation-State (`utils/metadataRefreshOperation.ts`): operationId, status, total, resumeIndex, processedIndexes, counters, errorDetails, lastProcessedSongId, startedAt/updatedAt – lebt in einem externen Store mit `useSyncExternalStore`, nicht mehr nur `useRef`.
- ✅ Statusmaschine: idle → running → cancelling → cancelled/resumable/partial → completed/failed.
- ✅ Abbrechen-Button im Import-Status sichtbar während des Refresh (`library-import-status-cancel`) – ruft den Lifecycle-Abort.
- ✅ Fortsetzen-Button erscheint nach Abbruch/Soft-Budget (`library-import-status-resume`); Menü-Eintrag liest „Metadaten-Update fortsetzen".
- ✅ Fehlerliste-UI im Import-Status (zeigt Dateiname + Grund, kompakt mit „… und N weitere" Fallback).
- 📱 Nativer Fast-Path: `extractMetadataFast(uri)` via `MediaMetadataRetriever` in `SystemAudioModule.kt`; TS-Interface, JS-Mock und Merger (`mergeFastMetadataIntoId3Tags`) implementiert. Aktuell ohne nativen Build automatisch als JS-ID3-Fallback aktiv. **Pending Android device validation**.
- ✅ Tests:
  - `metadataRefreshOperation.test.ts` (Status-Machine, Counter, Resume)
  - `LibraryImportStatus.test.tsx` (Cancel/Resume/Counter/Fehlerliste)
  - `LibraryMenuModal.test.tsx` (Fortsetzen-Label)
  - `useLibraryMetadataRefreshLifecycle.test.tsx` (cancelRefresh)
  - `songMetadataRefreshFastPath.test.ts` (Native-Merge, Fallback, errorDetails)

## Phase 3 – Bottom-Navigation entfernen ✅
- ✅ TabsShell entfernt → MainShell (Library als Hauptscreen)
- ✅ Equalizer ins 3-Punkte-Menü (Stack-Screen)
- ✅ MiniPlayer-Insets von Tabbar entkoppelt
- ✅ Tests

## Phase 4 – Ansichten & Sortierung ✅
- ✅ 3 Sortiermodi (Alphabet/Track/Jahr) + Persistenz + Control
- ✅ 4 Song-Ansichtsmodi (Liste/großes Raster/kleines Raster/Banner) + Persistenz + Control
- ✅ `albumViewMode` persistiert (Hydration-Guard in `useLibraryScreenState`, Storage-Round-Trip getestet, Default `grid` per `DEFAULT_LIBRARY_ALBUM_VIEW_MODE`).

## Phase 5 – Now-Playing Redesign ⏳
- ⏳ 2 vertikale Snap-Screens
- ⏳ Dynamische Akzentfarbe aus Cover
- ⏳ Hintergrund/Gradient aus Cover-Palette
- ⏳ Kontrastschutz für Text/Buttons
- ⏳ Fallback-Farben (kein Cover / keine Palette), keine harte Schwarz/Grün-Marke erzwingen
- Hinweis: native Farbpalettenextraktion ist geräteabhängig → JS-Fallback (deterministisch aus Metadaten) vorsehen

## Phase 6 – Waveform ⏳
- ⏳ Datenmodell + Cache, SVG-Rendering, native Peak-Extraktion (BG-Job)

## Phase 7 – TrackInfo erweitern ⏳
- ⏳ CBR/VBR, Cover-Dimensionen/Bytes

## Phase 8 – Queue Drag & Drop ⏳
- ⏳ echte Playback-Reihenfolge

---

## Offen wegen fehlendem Android-Gerät/Dev-Build (📱)
- Phase 2: nativer Metadaten-Fast-Path (Kotlin `extractMetadataFast`) – Code implementiert + Mock + JS-Fallback, **pending Android device validation** im Development APK.
- Phase 5: native dominante-Farb-Extraktion (JS-Fallback wird trotzdem voll umgesetzt)
- Allg.: androidApkInspector-Tests scheitern im Container (fehlende aapt/apksigner) – umgebungsbedingt, kein Code-Bug
