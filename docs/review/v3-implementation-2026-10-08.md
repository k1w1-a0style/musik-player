# Umsetzung des kumulativen Deep-Scan V3

08.10.2026 · Branch `codex` · Ausgangspunkt `a154070b82534f2c62e8eb7d362d6d96798e1c8c`

Die bestätigten V3-/V2-Codebefunde und unmittelbar umsetzbaren UI-Verbesserungen sind korrigiert. Die Preview-APK wird mit dem vorhandenen Preview-Zertifikat über CI erstellt. Gerätemessungen werden dadurch nicht ersetzt.

## Änderungen und Abnahme

| Reviewpunkt | Umsetzung | Regression/Nachweis |
| --- | --- | --- |
| V3-F1 Volume/Repeat | Gemeinsame geordnete Control-Lane mit vorhandenem Watchdog. Öffentliche Deadline gibt den realen Writer nicht frei; Bestätigung bleibt im bewachten Turn. Repeat-Taps gehen sofort in die gemeinsame Reihenfolge, Volume verwirft überholte Zwischenwerte. | Hängende Readiness/Bestätigung, später Erfolg/Fehler, gesperrte Reads/Folgewriter, UI-Rollback und Repeat-Next-Reihenfolge am echten V5-Adapter. |
| V2-F1 SongCard | Memo vergleicht vollständige immutable Songfelder einschließlich Änderungszeit/Hash. Aktionen lösen aktuelle Songs über ID aus dem aktuellen Listenstand auf. | Gleiche URI/Größe bei neuer Revision, neue Metadaten und Press/Info nach Update. |
| V3-P1 Playlist-Start | Einmaliger ID-Index, O(N + M), erster doppelter Bibliothekseintrag gewinnt. | Große Bibliothek, fehlende IDs, Playlistreihenfolge und mehrfach vorkommende Positionen. |
| V2-P1 Analysehistorie | Dirty-Version, gemeinsamer Flush, kein JSON für bereits dauerhaft bekannte Quellen. Fehlgeschlagene Writes bleiben retryfähig; Hydration und laufende Generationen werden berücksichtigt. | 100 wiederholte Markierungen ohne erneute Serialisierung, Write-/Hydrationfehler, Änderungen während Write und Generationwechsel. |
| V2-P2 Backdrop | Höchstens zwei ausgehende plus eine aktive Ebene; ältere Paletten gewichtet zusammengefasst, dazu repräsentatives Cover. Reduced Motion stoppt Übergänge. Kein zusätzlicher großflächiger Blur der Originalbilder. | Schnelle Wechsel, maximal drei Ebenen, Farbmischung, Stopp und Thumbnail-Fallback. |
| V2-P3 Bibliothek | Inhaltsadressiertes v2-Manifest bleibt lesbar. ID-Anker bilden stabile Recordgrenzen; Riesenrecords bleiben begrenzt, Surrogatpaare zusammen. Neue Chunks vor Manifestcommit verifiziert; unveränderte Chunks nicht doppelt gelesen. Cleanup per `multiRemove`. | Edit/Insert/Delete am Anfang, exakte Rekonstruktion, Unicode, alte v2-Manifeste/Legacy, beschädigte Werte, unterbrochene Writes, Manifestfehler/Retry, konkurrierende Aufrufe. |
| V2-P4 Covervarianten | Native optionale lokale PNG-Varianten: 64 Pixel Backdrop, 128 Zeile/MiniPlayer/Queue, 256 Tile/Album. Originale bleiben erhalten. Quelle und Revision im Cachekey, begrenztes Sampling, atomare Veröffentlichung, Cachebudget und Handoff-Grace. Maximal zwei JS-Generierungen, begrenzte Warteliste; fehlender/alter nativer Support und Bildfehler nutzen Original. | Kotlin-Tests für Größe, Wiederverwendung, Quelle/Revision, Reparatur und Trim; JS-Tests für Lifecycle, Fallback, alte APKs, In-flight-Deduplikation und Parallelitätsgrenze. Native Tests werden in CI ausgeführt. |
| V2-P5 Queue | Ein frischer, kompakter Adapter-Snapshot mit ID/Titel, aktivem Index/ID und Repeat. Keine vollständige JS-Metadatenkonvertierung; Konsistenzprüfung und Retry bleiben. | 2.000 Tracks ohne Zugriff auf URL/Extras-Konvertierung, Settlement-Gate und externe Trackwechsel. |
| V2-P6 MiniPlayer | Native Translate-Bewegung zwischen bestehenden Progress-Samples, kein zusätzlicher Poll. Pause/Buffering/Seek/Titelwechsel/Ende/unbekannte Dauer und Reduced Motion berücksichtigt. | Transform-/Timingregressionen und native Playback-State-Snapshot. |
| Große Schrift | FontScale bestimmt Song-Zeilen-/Bannerhöhe; feste Listenoffsets nutzen denselben Wert. | 100/130/160/200 Prozent, Layout und Renderer. Visuelle TalkBack-Abnahme bleibt Geräteaufgabe. |
| Suchqualität | Gemeinsame Normalisierung für Anfrage, Songs und Playlists einschließlich deutscher/polnischer Sonderzeichen. Vorhandenes Deferred Filtering bleibt. | Diakritika- und kombinierte Feldsuche. |
| Playlist-Auswahl | Kandidatenfilter nur bei offenem Add-Dialog, aktuelle Songdaten beim Öffnen; Safe-Area und KeyboardAvoidingView. | Geschlossenes Modal filtert nicht, aktuelle Kandidaten und Inset-/Keyboardstruktur. |
| EQ-Renderbereich | Separater memoierter EQ-Context statt breitem MusicContext. Bestehender Band-Scheduler unverändert. | Volume-/Playlistupdates rendern EQ-Consumer nicht, Bandänderung tut es. |
| Waveform-Restfarbe | Bereits neutraler zentraler Wert `#ededed` beibehalten. | Vorhandene Farbtests; keine Peaks-Neuberechnung für Farben. |

## Persistenzmessung

Reproduzierbar: `node scripts/benchmarks/v3LibraryPersistence.cjs`. Rohdaten: `docs/review/v3-persistence-2026-10-08.json`.

Bei 5.000 Songs mit jeweils 500 Zeichen Titelfixture schreibt eine Änderung am ersten Titel 38.947 statt 2.886.751 UTF-16-Code-Units an Chunkdaten: ein statt 23 Chunks, rund 98,65 Prozent weniger Chunk-Schreibvolumen. Insert und Delete bleiben ähnlich lokal. Bei unverändertem Snapshot halbiert sich das gelesene Chunkvolumen von 5.773.342 auf 2.886.671 Code-Units.

Das ist kein Android-Latenzbenchmark. JSON-Erzeugung durch den Aufrufer ist nicht Teil dieser Probe und bleibt vollständig. Die Writer-Probe nutzt In-Memory-Storage; CPU ist etwa 19 statt 13–14 ms und die Zahl der Chunkkeys steigt auf 80 statt 23. Gesamtdurchsatz, JS-Pausen und tatsächliche Bridge-/Datenträgerkosten müssen am Gerät beurteilt werden. Cleanup ist gebündelt, scannt aber weiterhin die Keys. Analysehistorie wird nicht willkürlich gelöscht.

## Verifikation und Grenzen

Lokale Toolchain: Node 22.23.3, unverändertes Lockfile. Typecheck, ESLint ohne Warnungen, Complexity-/NUL-Gates, 13 Python-Diagnostiktests, fokussierte Regressionen und Produktions-Android-Bundle/Dependency-Boundary wurden ausgeführt. Der erste Gesamt-Coveragelauf fand einen zentralen Farbregelverstoß beim neuen Palette-Mischen; der Helfer liegt jetzt in `appThemeOverlays`, die Regel und Backdroptests bestehen. Finaler lokaler Gesamtlauf: 368 Suites / 3.664 Tests bestanden, Coverage 93,46 % Statements / 85,47 % Branches / 95,14 % Functions / 95,93 % Lines. Die abschließende Revision des gemeinsamen Artwork-Helfers wurde zusätzlich mit 38 betroffenen Tests geprüft. Die exakten CI-Gates bestimmen die native Freigabe dieses Commits.

Expo-Onlineprüfung war lokal durch einen Proxytimeout blockiert; Offlineprüfung meldet passende Dependencies mit eigener Warnung zur eingeschränkten Validierung. CI prüft die Onlinekompatibilität zusätzlich. Kotlin-Compile, echte native Tests, APK-Signatur/Identität und Berechtigungen werden durch die vorhandene CI geprüft, da hier kein Android-SDK verfügbar ist.

Noch ohne echten A50-Nachweis: p50/p95 Navigation, Scrollframes/RAM, Kaltstart, tatsächlicher OS-Kill, Cloud-SAF-/Display-Aus-Szenarien, TalkBack/200-Prozent-Schrift und Tastatur. Eine Audio-Sessionänderung ohne Song-ID-Wechsel war in V3 ein Prüfszenario, kein bestätigter Defekt; kein spekulativer EQ-Recoveryumbau. Die drei Ebenen bewahren die gewichtete Palette; die genaue Mischung aller früheren Coverbilder wird bewusst durch ein repräsentatives Bild angenähert.

Optionale Produktideen (zusätzlicher AMOLED-Modus, weiterer ruhiger Listenstil, zusammenklappbare Scanübersicht und das getrennte Ideendokument) werden nicht als bestätigte Fehler ausgegeben. Vorhandene Minimal-/Graphite-Stile bleiben verfügbar. Kein ungeprüftes SQLite-/Backend- oder Signing-Migrationsprojekt.

Die beiden befristeten Dependency-Ausnahmen (Issue #396, Ablauf 21.10.2026) werden nicht verlängert. Branchschutz ist eine Repository-Administrationseinstellung, keine APK-Korrektur. Das Preview-Zertifikat bleibt `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; Übereinstimmung mit einer tatsächlich auf dem A50 installierten fremden APK wird nicht behauptet.
