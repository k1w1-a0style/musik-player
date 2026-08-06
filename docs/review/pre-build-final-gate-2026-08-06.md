# Finaler Pre-Build-Gate — 2026-08-06

## Scope

Dieser Abschlussreview bewertet den aktuellen `codex`-Stand nach den Hardening-PRs #363–#374. Er verändert keine Runtime-, Native-, Storage-, Workflow- oder Dependency-Logik. Zweck ist, den endgültigen Review- und CI-Stand nachvollziehbar festzuhalten, bevor später separat überhaupt über eine Development-APK entschieden wird.

Ausgangs-SHA vor diesem Dokument: `b3f844b98898b2171cddc31919460482170633ba`.

## Release-Grenze

- Keine Development-, Preview- oder Production-APK in diesem Abschlusslauf.
- Kein AAB, kein EAS-Build, kein `assemble`/`bundle`, kein Emulator, keine Installation und kein Deployment.
- Ein Development-Build benötigt nach diesem Gate weiterhin eine separate ausdrückliche Freigabe.

## Repository-/PR-Hygiene

- Vor Start dieses Abschlusslaufs: keine offenen PRs gegen `codex`.
- PR #373 wurde korrekt ohne Merge geschlossen, weil nur ein Testentwurf und kein vollständiger Produktionsrefactor vorhanden war.
- PR #374 wurde nach manuellem Semantikreview bereinigt und integriert.
- Keine temporären Trigger-/Workflow-Dateien aus den Hilfsprüfungen sind im `codex`-Baum verblieben.

## Supply Chain

Aktueller, seit PR #368 unveränderter Dependency-Graph:

- `undici` ist auf `6.28.0` gehärtet.
- `xcode -> uuid` ist gezielt auf `11.1.1` gehärtet.
- Production-Audit des unveränderten Dependency-Graphs: 0 Critical, 0 High, 1 Moderate.
- Einzig verbleibender Fund: `tar 7.5.19`, GHSA-r292-9mhp-454m, Moderate, betroffener Bereich `<=7.5.20`.
- npm veröffentlicht am 2026-08-06 weiterhin `7.5.19` als `latest`; ein kompatibler sicherer 7.x-Patch ist daher aktuell nicht verfügbar.
- Keine Audit-Ausnahme ist eingetragen (`security/npm-audit-exceptions.json` ist leer).
- Das Audit-Policy-Gate blockiert unerwartete High-/Critical-Advisory-Roots; der verbleibende Moderate-Upstream-Fund wird sichtbar dokumentiert und nicht verschwiegen.
- Kein `npm audit fix --force`, kein Expo-Downgrade und kein unkoordinierter Major-Sprung.

Bewertung: kein repositoryseitig sicher behebbarer Supply-Chain-Blocker verbleibt. Der `tar`-Fund bleibt als Upstream-Wartungspunkt in #319 offen.

## Complexity-/Architektur-Gegencheck

Die aktuelle Baseline enthält 44 aktive Ratchet-Ausnahmen, gegenüber 49 beim Beginn des letzten Pre-Build-Reviews.

Aufteilung:

- 15 Funktionen überschreiten die Standard-Complexity von 15;
- 29 weitere Funktionen überschreiten ausschließlich das Standard-Längenlimit von 80 Zeilen bei Complexity <= 15;
- keine Grenze wurde für neue Funktionen erhöht und es fand kein pauschales Re-Baselining statt.

### Kritisch geprüfte Complexity-Hotspots (>15)

1. `components/SongCard.tsx::<memo-callback>#1` — lange reine Gleichheitsprüfung; kein Seiteneffekt.
2. `components/SongCard.tsx::SongCardComponent#1` — UI-Varianten/JSX; keine persistente Zustandsmaschine.
3. `hooks/useLibraryMetadataRefreshRunner.ts::<useCallback-callback>#1` — Chunk-/Timeout-/Resume-Orchestrierung mit Generation- und Partial-Result-Grenzen.
4. `screens/TagEditorCoverControls.tsx::TagEditorCoverControls#1` — UI-/Accessibility-Zustände; keine Write-Entscheidung als eigene Source of Truth.
5. `screens/useTagEditorSaveFlow.ts::<useCallback-callback>#1` — Tag-Write, Stale-Generation, Re-Read und Verification bleiben fail-closed.
6. `utils/id3Parser.ts::decodeAPIC#1` — begrenztes Binärformat-Decoding mit Bounds-Prüfungen.
7. `utils/id3Parser.ts::decodeComm#1` — begrenztes COMM-Decoding; der frühere PR #373 war nur ein nicht integrierter Refactor-Versuch, kein bestätigter Funktionsfehler.
8. `utils/id3Parser.ts::findMp4Tags#1` — rekursive MP4-Suche mit Depth-Limit, Atomgrößen-/Boundary-Prüfungen und konservativem Skip-Verhalten.
9. `utils/id3Parser.ts::parseId3TextFramesByRange#1` — begrenzter Range-Scanner mit Scan-/Body-Limits und Abort-Prüfungen.
10. `utils/id3Parser.ts::readUtf8#1` — defensiver UTF-8-Decoder; Complexity entsteht aus Validierungszweigen.
11. `utils/mediaLibraryImport.ts::buildSongFromImportSource#1` — reine Import-Zusammensetzung/Fallbacks; keine rekursive Kontrolle.
12. `utils/mediaLibraryImport.ts::walk#1` — SAF-Rekursion ist durch Datei-, Tiefen- und Verzeichnislimits, Abort, Timeout und Yield begrenzt.
13. `utils/tagWriterId3.ts::parseFrames#1` — defensive Frame-/Flag-/Size-Prüfung; unsupported Strukturen fail-closed.
14. `utils/tagWriterId3.ts::readId3Header#1` — defensive ID3-Header-/Extended-Header-Prüfung; ungültige/unsupported Daten fail-closed.
15. `utils/tagWriterMp4.ts::applyMp4TagEditToBuffer#1` — Atomstruktur wird vollständig validiert; `moov-before-mdat`-Größenänderungen werden aus Offset-Sicherheitsgründen blockiert.

Ergebnis: Im manuellen Gegencheck wurde in diesen 15 Hotspots kein neuer bestätigter P0-, P1-, P2- oder P3-Funktionsfehler gefunden. Die verbleibenden Ausnahmen sind technische Schuld unter einem strikten Nicht-Wachstums-Ratchet und keine Freigabe, neue Komplexität hinzuzufügen.

### Längen-Ratchets

Die 29 reinen Längenüberschreitungen besitzen Complexity <= 15. Besonders lange Vertreter wurden zusätzlich geprüft:

- `useLibraryController` ist hauptsächlich Komposition bereits ausgelagerter State-/Action-/Renderer-/Props-Hooks.
- `LibraryTabContent` ist tababhängige deklarative Listenzusammensetzung.
- `NowPlayingScreenInner` komponiert bereits getrennte Panel-/Pager-/Header-/Modal-Komponenten.
- `PlaylistDetail` ist groß, aber überwiegend deklaratives UI und kleine lokale Handler; Complexity bleibt 9.
- `refreshSongsFromId3` besitzt begrenzte Concurrency-/Timeout-/Abort-/Progress-Verträge; Complexity bleibt 5.

Bewertung: weitere Zerlegung ist sinnvoller Wartungs-/Refactoring-Backlog, aber aus dem Review ergibt sich kein bestätigter Release-Blocker allein aus der Funktionslänge.

## Kritische Integrationsbereiche — Abschlussabgleich

Bereits integrierte Hardening-Verträge wurden gegen den aktuellen Baum erneut abgeglichen:

- Waveform-Cache: unabhängige Fingerprint-Bindung, Hashkollisionsschutz, Index-Rebuild/Rollback/Clear-Recovery.
- SAF-/Tag-Write: persistente Operation-ID-/Receipt-/Recovery-Verträge, Kapazitätsgrenze und fail-closed lokale `file://`-Writes ohne persistentes Journal.
- TrackPlayer: echte Setup-/Optionsfehler werden nicht mehr als Ready maskiert.
- Native Metadata/Artwork: Feldfehler isoliert; Bitmap-Ressourcen werden auch im Fehlerfall freigegeben.
- Palette: globale Single-Flight-Grenze verhindert unbeschränkte abgelöste Native-Arbeit.
- Native Reads/Backfill: Timeout-/Abort-/Stale-Pfade und begrenzte Parallelität wurden gehärtet.
- Logging: bekannte native URI-/Pfad-Diagnosen wurden redigiert.
- Workflow-Sicherheit: externe Build-Refs werden gegen vertrauenswürdige `codex`-/`main`-Historie autorisiert; Production bleibt an den exakten `main`-Head gebunden.
- Android-/Manifest-/Permission-Gates bleiben Bestandteil der vollständigen CI.

Im Abschlussgegencheck wurde kein neuer bestätigter P0/P1/P2/P3-Blocker gefunden.

## Noch erforderlicher technischer Nachweis

Vor dem Einfrieren eines Development-Kandidaten muss die vollständige GitHub-CI auf dem Head dieses Abschluss-PRs erfolgreich sein:

- reproduzierbare Installation;
- Production-Audit + Policy;
- Source-NUL;
- Typecheck;
- vollständige Jest-/Coverage-Suite + Enforcement;
- ESLint;
- Complexity-Ratchet;
- Expo-Konfigurationsgate;
- generiertes Android-Manifest-/Permission-Gate;
- Android-Prebuild ausschließlich für native Checks;
- JDK 17 / Kotlin-Kompilierung;
- tatsächlich ausgeführte native JVM-/JUnit-Tests.

Erst ein grüner Lauf dieses vollständigen Gates macht den geprüften Head zum Pre-Build-Kandidaten. Paketierung bleibt davon getrennt.
