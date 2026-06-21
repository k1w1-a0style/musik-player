# K1W1 Musikplayer – Arbeitsplan TODO

Status-Legende: ✅ fertig & getestet · 🔄 in Arbeit · ⏳ offen · 📱 implementiert, Android-Geräteprüfung offen

Verifikation vor jedem Abschluss: `typecheck` + `lint:ci` + `jest --runInBand`.
Reihenfolge folgt dem Deep-Scan-Arbeitsplan (Phasen 1–8).

---

## Phase 1 – Seek/Scrubbing-Performance ✅
- ✅ Drag-Scrubbing (PanResponder) mit optimistischem Thumb, kein Rubber-Band
- ✅ Dedizierte Seek-Lane (last-value-wins), nicht hinter Queue-Rebuilds
- ✅ Tests (seekController, Scrub-Math)

## Phase 2 – Metadaten-Refresh stabilisieren 🔄
- ✅ Per-Track-Timeout statt globalem Abbruch (kein „67/83"-Teilscan mehr)
- ✅ Soft-Budget statt hartem 90s-Timeout
- ✅ Backfills pausieren während manuellem Refresh
- ✅ Fehlerliste (errorDetails: uri + Grund)
- ✅ Live-Fortschritt mit Zählern (x/y · aktualisiert · übersprungen · fehlgeschlagen)
- ⏳ Abbrechen/Fortsetzen-Button (testbar, ohne Gerät) → JETZT umsetzen
- 📱 Nativer Fast-Path (MediaMetadataRetriever, Kotlin) – Geräteprüfung offen

## Phase 3 – Bottom-Navigation entfernen ✅
- ✅ TabsShell entfernt → MainShell (Library als Hauptscreen)
- ✅ Equalizer ins 3-Punkte-Menü (Stack-Screen)
- ✅ MiniPlayer-Insets von Tabbar entkoppelt
- ✅ Tests

## Phase 4 – Ansichten & Sortierung 🔄
- ✅ 3 Sortiermodi (Alphabet/Track/Jahr) + Persistenz + Control
- ✅ 4 Song-Ansichtsmodi (Liste/großes Raster/kleines Raster/Banner) + Persistenz + Control
- ⏳ albumViewMode persistieren (Validierung/Default, Restore nach Neustart, Tests) → JETZT umsetzen

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
- Phase 2: nativer Metadaten-Fast-Path (Kotlin)
- Phase 5: native dominante-Farb-Extraktion (JS-Fallback wird trotzdem voll umgesetzt)
- Allg.: androidApkInspector-Tests scheitern im Container (fehlende aapt/apksigner) – umgebungsbedingt, kein Code-Bug
