# Arbeitsplan V3 – Umsetzungsnachweis

## Paket 1: Quellenintegrität und Albumlogik

Ausgangspunkt: `a1725abb0050bc64cb4b3445624f382658eca8fc`. Stand: 11.10.2026.

**F01/F02:** Gemeinsame Quellenidentität erhält bedeutende Groß-/Kleinschreibung und kodierte Dokumentsegmente. Überlappende SAF-Grants derselben Dokument-ID werden erkannt. Dateiname, Größe und Dauer führen unabhängige Quellen nicht mehr automatisch zusammen. Opaque Provider-Queries und Fragmente bleiben bedeutend; bei `file://` werden reine URI-Cachezusätze entfernt.

**F06:** Expo-Filesystem-Sekunden werden an der Adaptergrenze in Millisekunden umgerechnet. Exakt passende plausible Altwerte in Epoch-Sekunden werden beim nächsten erfolgreichen Quick-Scan migriert, ohne Song-ID oder Audio-Vorbereitungsrevision zu erneuern. Echte Größen-, Hash- und Datumsänderungen bleiben Änderungen.

**F03:** Import/Refresh können bestätigte fehlende Angaben jetzt explizit melden. Vollständig gelesene unterstützte ID3v2-Tags beziehungsweise nachgewiesene MPEG-Audiodaten und ein erfolgreicher begrenzter Tailcheck ermöglichen das Entfernen optionaler Tags. Nicht lesbare, abgeschnittene, transformierte oder unbekannte Metadaten erzeugen keinen Löschbeleg. ID3v1/APE/Lyrics-Tailhinweise verhindern eine voreilige Löschung. Native bestätigte Coverabwesenheit kann alte eingebettete Covers entfernen; ausstehende oder fehlgeschlagene eigene Cover-Vorschauen bleiben geschützt. Prüfbelege werden nicht als dauerhafte Löschanweisungen weitergereicht.

**Grenze F03:** Die automatische Bestätigung fehlender Textfelder für MP4/M4A und nicht unterstützte Tagvarianten ist in diesem Paket noch offen. Solche Angaben bleiben konservativ erhalten. Ein grüner Test der Löschschnittstelle bedeutet keine vollständige Formatabnahme.

**F04/F05:** Albumansicht und daraus erzeugte Queues folgen Disc, Track, Titel und stabiler ID. Fehlende Disc bedeutet Disc 1, fehlende Tracknummer folgt bekannten Tracknummern. Gleichnamige Künstleralben sind getrennt; ein expliziter Albumartist verbindet Compilations. Die Suchansicht verwendet den vollständigen Bestand für begrenzte Albumartist-Inferenz beim selben Trackkünstler, ohne fremde Künstleralben pauschal zu übernehmen.

**Migration:** Bestehende Songreferenzen bleiben beim erkannten Reimport erhalten. Frühere versehentliche Zusammenführungen werden nicht geraten aufgespalten. Neue unabhängige Quellen können beim erneuten Scan getrennt aufgenommen werden.

**Neue Regressionen:** Sieben ursprüngliche Fehlerfälle plus URI-/Encodinggrenzen, sichere Epoch-Migration, native/JS-Tagkombination, Preview-Schutz, begrenzte Head-/Tailprüfung, Tailfehler, File-API-Fallback, Abbruch und stabile Suchgruppen. Alte Tests, die case-folded Dateipfade und schwache Duplikatbeweise verlangten, wurden auf den korrigierten Vertrag umgestellt.

**Lokal bestätigt unter Node 24.19.0:** 374 Jest-Suiten / 3.718 Tests bestanden; Coverage 93,48 % Statements / 85,47 % Branches / 95,22 % Functions / 95,94 % Lines, alle konfigurierten Schwellen bestanden. Typecheck, ESLint mit null Warnungen, Komplexität, Source-NUL, Expo-Release-Konfiguration, generiertes Android-Manifest und Android-Hermes-Export samt Dependency-Boundary bestanden. Der Offline-Expo-Dependencycheck meldet kompatible installierte Versionen, weist aber ausdrücklich auf die eingeschränkte Offline-Verlässlichkeit hin. 13 Python-Regressionen der Diagnose-Skripte bestanden.

**Korrektur des Laufzeitnachweises:** Nach der Wiederaufnahme am 11.10.2026 war die zuvor installierte Node-22-Binary nicht mehr vorhanden. Der PATH-Zusatz fiel unbemerkt auf Node 24 zurück. Der oben genannte vollständige Wiederholungslauf ist deshalb ein Node-24-Nachweis; eine frische Wiederholung unter ausdrücklich geprüfter Node 22 ist erforderlich. Der ursprüngliche Baselinelauf vor der Unterbrechung war tatsächlich Node 22.23.3.

**Frische Wiederholung abgeschlossen:** Node 22.23.3 wurde erneut installiert und vor jeder weiteren Ausführung auf Hauptversion 22 geprüft. Unter dieser Laufzeit bestanden erneut alle 374 Suiten / 3.718 Tests des Pakets (die neuen Workflow-Regressionsfälle separat geprüft). Coverage: 93,50 % Statements / 85,48 % Branches / 95,22 % Functions / 95,96 % Lines. Typecheck, Lint, Komplexität, Source-NUL, Manifest- und Bundle-Boundary wurden erneut unter Node 22 bestätigt. Die 20 Node-Tests des EAS-Artefaktresolvers bestanden ebenfalls. Die GitHub-CI zu Commit `1b793d382aaa0365d88c6de3500d00180035a0e5` bestätigt inzwischen die Node-22-Qualitäts- und Securityjobs; der native Job wurde beim nachfolgenden Push durch die bestehende CI-Concurrency abgebrochen. Der Lauf zum nachfolgenden Commit `9760a811f3c769cc8a6a0c1fd52bbb9d95474ff9` bestätigt Quality und Security erneut; seine native Prüfung bestand inzwischen ebenfalls: CI-Lauf [38150756821](https://github.com/k1w1-a0style/musik-player/actions/runs/38150756821), `:app:assembleDebug`, 162 SystemAudio- und 10 RNTP-Tests, jeweils null Fehler. Diese Evidenz gehört exakt zu `9760a811` und ist noch keine Geräteprüfung oder Freigabe des folgenden Pakets. Ein abgebrochener Lauf ist keine native Freigabe.

**Nicht bestätigt:** neuer Gradle-/APK-Build, Geräteprüfung, A50-RAM/Frames/CPU/Akku. Die hierfür erforderlichen späteren Prüfungen sind offen.

## Paket 2: Autofix veröffentlicht erst geprüfte Quellen (F23)

Ausgangspunkt: `1b793d382aaa0365d88c6de3500d00180035a0e5`. Keine Datenmigration.

Der manuelle CI-Lite-Autofix führt jetzt erst ESLint-Fixes, danach verbindlichen Lint/Typecheck, vollständige Jest-Coverage, Source-NUL, Komplexität, Expo-Kompatibilität, Manifest-, Bundle- und Release-Configprüfungen aus. Die schwächeren Lint-/Typecheck-Fallbacks entfallen. Ein fehlgeschlagener Fix oder Gate verhindert Writeback; der Writeback prüft die erfolgreichen Ergebnisse zusätzlich selbst.

Staging umfasst ausschließlich tatsächlich geänderte, bereits getrackte JS-/TS-Quelldateien. Vorhandene Staging-Einträge, andere getrackte Änderungen, Löschungen und Umbenennungen werden abgelehnt. Ungetrackte Testlogs und generierte Dateien werden nicht veröffentlicht. Commitfehler oder Pushfehler führen zu Fehlerstatus; ein normaler Fast-Forward-Push erhält die Branchschutzregeln. Kein `git add -A`, kein `[skip ci]`, keine Force-Pushes. Der Token ist nur im Writeback-Schritt verfügbar; Checkout hält keine Credentials vor. Die Ergebnisse werden nach Writeback ergänzt, und die Zusammenfassung verwendet sichere Textformatierung statt versehentlicher Shell-Kommandosubstitution.

**Regression:** Acht korrekte neue Fälle scheiterten auf dem vorherigen Workflow. Nach dem Fix bestehen neun ausführbare Fälle mit temporären Git-Repositories und Tool-Doubles: Reihenfolge, gescheiterter Lint/Typecheck/Coverage/Komplexitätscheck, abgelehnte Gate-Ergebnisse, ausschließlich vorgesehene Quellen im Commit und Ablehnung unerwarteter Dependencyänderungen. Vier Workflowsuiten mit insgesamt 337 Tests bestanden unter Node 22; Typecheck, Lint und Komplexität ebenfalls.

**Grenze:** Die Negativprüfung führt die echten Workflow-Shellblöcke lokal aus; sie erzeugt bewusst keinen absichtlich kaputten Remote-Commit. Eine native Android-Prüfung ist weiterhin Aufgabe der regulären CI und späteren Geräteabnahme.


## Paket 3: Scanabschluss, Ordner-Speicherung, Tagvertrag und Touchflächen (F07–F10, F24/F25)

Ausgangspunkt: `9760a811f3c769cc8a6a0c1fd52bbb9d95474ff9`. Keine gespeicherten Daten werden umbenannt oder gelöscht; die Änderungen betreffen den Ausführungs-/UI-Vertrag.

**F07:** Capability, Rohplan, öffentlicher Plan, Editor-Sicherheitshinweis und Writer verwenden dieselbe tatsächliche Sperre für lokale `file://`-Tagwrites ohne dauerhaftes Recovery-Journal. Ein explizit übergebener Produktionsadapter kann die Sperre nicht umgehen; auch der direkte interne Writer bricht vor Dateizugriffen ab. Die frühere nachträgliche Plan-Umschreibung entfällt. Der ausdrücklich injizierte Fixtureadapter bleibt für Tests des Backup-/Rollbackalgorithmus erhalten; produktive Aufrufer verwenden ihn nicht. Bestätigte SAF-Herkunft und das native dauerhaft gesicherte Writer-Interface bleiben Voraussetzungen für den Editor.

**F08:** SAF- und MediaLibrary-Flows geben die nachweislich übernommenen Vorbereitungskandidaten zurück. Der orchestrierende Import beendet zuerst den Scan, gibt die UI frei und lässt die Waveformanalyse mit eigener Cancellation-/Statusverwaltung weiterlaufen. Ein neuer Scan stoppt die bisherige optionale Vorbereitung; Scanabbruch nach abgeschlossenem Import ändert dessen Ergebnis nicht. Ein nach einem Await überholter Import wird vor dem Abschluss erneut auf Aktualität geprüft. Dateiprogress wird in einem eigenen kleinen UI-Abonnenten angezeigt; Speicher- und Waveformphase erhalten getrennte Beschriftungen, Zähler und aktuelle Datei.

**F09:** Ein fehlgeschlagenes oder noch unbestätigtes Speichern von Ordnerzuständen ergibt sichtbaren Teilerfolg, Warnung und „Ordnerdaten erneut speichern“. Bestätigte Songs bleiben verfügbar. Retry speichert nur diese Ordnerdaten erneut, liest keine Audiodateien und beginnt keinen neuen Scan. Nach einem Observer-Timeout bleibt Retry bis zum tatsächlichen Abschluss des Schreibvorgangs gesperrt. Späterer Erfolg räumt die Warnung auf; spätere Ablehnung ermöglicht Retry. Alte Retrycallbacks beeinflussen keinen neuen Scan. Ein unabhängig unvollständiger Dateiscan bleibt nach erfolgreichem Retry unvollständig.

**F10:** Zeilen/Banner reservieren eigene Status- und Menüplätze. Beide Touchflächen sind 48 dp; künstlich überlappende HitSlop-Flächen entfallen. Kacheln erhalten eine eigene Aktionszeile, die bei enger Breite umbrechen kann. Retry stoppt die Eventweitergabe an die Wiedergabeaktion. Audio bleibt bei pending/analyzing/unavailable bedienbar. Die zwei ungenutzten Styles `SongCard.preparing` und `LibraryImportStatus.detailsText` entfallen; der zuvor ungenutzte File-Progress-Hook ist nun angebunden (Teil F22).

**Regressionen:** Sechs neue Sollfälle scheiterten zuvor auf dem vorhandenen Scan-/UI-Code: zwei ungelöste Waveform-Promises, ein verschluckter Ordnerspeicherfehler und drei überlagerte Varianten. Zusätzliche Tests prüfen Timeoutbesitz, spätes Settlement, wiederholten Retryfehler, überholte Callbacks, Abbruch vor Write, unabhängig partielle Scanergebnisse, sichtbare Retryaktion und aktuelle Metadatendatei. Der Tagtest prüft außerdem explizite Produktionsadapter-Injektion und direkten Writerzugriff ohne I/O.

**Prüfung:** Unter ausdrücklich geprüfter Node 22.23.3 bestehen 376 Jest-Suiten / 3.742 Tests; Coverage zuletzt 93,47 % Statements / 85,44 % Branches / 95,32 % Functions / 95,93 % Lines und alle konfigurierten Schwellen. Typecheck, Lint ohne Warnungen, Source-NUL und Komplexität bestehen. Der echte Expo-Prebuild besteht das Manifest-Gate; der Produktions-Hermes-Export mit 1.610 Quellen besteht die Bundle-Boundary. Die frische Wiederholung nach der zusätzlichen Aktualitätsprüfung besteht erneut mit allen 376 Suiten / 3.742 Tests. Nach dem letzten Layoutpatch bestehen zusätzlich die drei betroffenen UI-/Import-Suiten mit 53 Tests sowie Typecheck, Lint und Komplexität.

**F24:** README nennt jetzt den installierten Expo-57-/RN-0.86-/React-19.2-/Node-22-/RNTP-5-Stack, den verbindlichen lokalen Schreibstopp und die getrennten Scanphasen. V2-Nachweise sind ausdrücklich historisch.

**F25:** Frischer Registry-/Advisory-/Auditabgleich am 11.10.2026: 0 Critical, 23 High, 5 Moderate; Policy-Gate besteht mit unveränderten exakten Ausnahmen bis 21.10.2026. Für braces 3.0.3, node-forge 1.4.0 und sprintf-js bis einschließlich 1.1.3 ist weiter kein gepatchter veröffentlichter Stand verfügbar. Entscheidung und Primärquellen sind im Sicherheitsbericht dokumentiert. Diese Upstream-Schwachstellen sind damit bewertet, **nicht behoben**; keine Fristverlängerung und kein Expo-Downgrade.

**Grenzen:** Die Node-/Jest-/Hermesnachweise ersetzen keine native UI-Abnahme. A50, SAF-Providerverhalten, TalkBack und Schriftgröße 2,0 benötigen die abschließende Geräteprüfung. F03 für vollständige MP4/M4A-Entfernungsbelege und die späteren Performance-/Backup-/Resume-Pakete bleiben offen.

**Nachtrag zum veröffentlichten Paket 3:** Commit `9f450f441fc8fae8cae0c7bb8fc3a132c5a0a2dd`, CI [38152670621](https://github.com/k1w1-a0style/musik-player/actions/runs/38152670621) vollständig erfolgreich. Tatsächlich ausgeführt: `:app:assembleRelease`, 162 SystemAudio- und 10 RNTP-Tests ohne Fehler. Preview-APK: 100.555.217 Bytes, Paket `com.k1w1a0style.musikplayer`, alle vier ABIs einschließlich x86_64, Signatur und Manifestpolicy bestätigt. APK-SHA-256: `a53e05e84f9b0390900257521a444d49fdae284f431362ec5e8107f8682eeb3c`. Dies belegt den Build des Pakets 3, nicht den folgenden MP4-Fix. Die zwei nativen Warnungen zur veralteten Expo-`Constants`-API sind eingeordnet: kein Buildfehler; auf `Constant`/`Property` erst mit gesonderter Kompatibilitätsprüfung umstellen.

## Paket 4: Begrenzte MP4-/M4A-/M4B-Entfernungsbelege (F03)

Ausgangspunkt: `9f450f441fc8fae8cae0c7bb8fc3a132c5a0a2dd`. Keine neue Speicherformatmigration.

Ein vollständiger, begrenzt gelesener `moov` mit genau einer unterstützten iTunes-`ilst`-Hierarchie kann jetzt bestätigen, welche optionalen Angaben fehlen. Die Prüfung folgt den tatsächlichen Top-Level-Atomgrenzen statt zufälligen Signaturen in Audiodaten; `mdat` wird über seine Länge übersprungen. Nur bekannte Container und Metadatenfelder erlauben eine Abwesenheitsbestätigung. Ein vorhandenes Feld bleibt vorhanden, auch wenn sein Wert nicht dekodiert werden kann. Ohne Coverprüfung wird keine Coverabwesenheit behauptet.

Unbekannte `keys`-/UUID-/ID32-/Freeform-Strukturen, mehrere Metadatenlisten, unvollständige oder übergroße Atome, Lesefehler und überschrittene Budgets bleiben unbestimmt; bestehende Angaben werden erhalten. Das ist eine bewusst begrenzte Formatunterstützung, keine Behauptung, jede MP4-Variante lesen zu können. Ohne passende vollständige Metadatenliste gibt es ebenfalls keinen Löschbeleg. Bestehendes kontrolliertes UTF-8-Fallback für lesbare Werte bleibt erhalten. Die Inspector-Reads prüfen Cancellation vor und nach I/O; der File-API-Fallback hält seinen Handle bis zum Ende der zusätzlichen Prüfung offen.

**Regression:** Zwei neue korrekte Fälle scheiterten vor dem Fix. Danach bestehen 130 gezielte Parser-/Writer-/Mergefälle; zusätzliche Handle-/Abbruchfälle bestehen mit insgesamt 62 Tests in den beiden betroffenen Suiten. Abgedeckt sind vollständige Head-/Tailstrukturen, vorhandene unlesbare Werte, ausgeschlossene Cover, bekannte Felder, ungültige Brands, doppelte Container, kurze Reads, 64-Bit-Längen, sichere Integergrenzen, Traversal-/Bytebudgets und Cancellation. Eine virtuelle 200-MB-Datei erfordert für die zusätzliche Containerprüfung weniger als 256 Bytes Range-Reads; das ist ein I/O-Grenztest, kein Gerätebenchmark.

**Prüfung unter Node 22.23.3:** Frischer vollständiger Lauf: 377 Suiten / 3.770 Tests bestanden, Coverage 93,51 % Statements / 85,60 % Branches / 95,34 % Functions / 95,95 % Lines. Der erste Gesamtlauf hatte einen bestehenden Library-UI-Test im 5-Sekunden-Limit; dessen isolierte Wiederholung und der anschließende komplette Wiederholungslauf bestehen mit unverändertem Zeitlimit. Typecheck, Lint ohne Warnungen, Komplexitäts- und Source-NUL-Gate bestehen. Der bewusst zunächst rote, noch nicht zu diesem Paket gehörende F16-Regressionstest war beim Gesamtlauf ausgeschlossen; alle Tests des veröffentlichten MP4-Pakets waren enthalten. Die zwei später ergänzten Lifecyclefälle wurden gezielt nachgeprüft; die Produktionsquellen blieben dabei unverändert.

**Geräteprüfung derzeit blockiert:** Die Limrun-MCP-Verbindung ist vorhanden, die CLI ist jedoch nicht authentifiziert. Der neue APK-Download ist privat; der serverseitige Installationsversuch über den vorhandenen Dateilink scheitert mit HTTP 401. Ältere Limrun-APKs werden deshalb nicht als Nachweis dieses Commits verwendet. Eine Emulator-/A50-Abnahme und die folgenden Funktionspakete bleiben offen.

Primärquellen für Formatgrenzen: [Apple – Metadata atoms and types](https://developer.apple.com/documentation/quicktime-file-format/metadata_atoms_and_types), [FFmpeg – MOV/MP4-Demuxer](https://github.com/FFmpeg/FFmpeg/blob/master/libavformat/mov.c). Die konservative Löschentscheidung ist eine projektspezifische Sicherheitsregel.

## Paket 5: Ein Waveform-Cache-Durchlauf (F16)

Ausgangspunkt: `5b65c654c03465f895052956da86b347108e1f0f`. Keine Cacheformat- oder Bibliotheksmigration.

Die vorbereitende Prüfung aller Songs und die anschließende identische Prüfung jedes fehlenden Songs sind zusammengeführt. Jeder Song prüft seine tatsächlichen Cache-Daten direkt vor einer nötigen Analyse. Nur nach echter Scheduler-Konkurrenz wird erneut geprüft, da die sichtbare Wiedergabe die Waveform inzwischen erstellt haben kann. Vorhandene Budgets, serialisierte Analyse, Abbruch, Timeout, native Prioritäten und die Prüfung tatsächlich gespeicherter Payloads bleiben erhalten. Cachetreffer verursachen keinen neuen Completion-History-Write.

Die Fortschrittsanzeige zählt jetzt alle geprüften Quellen einschließlich Cachetreffern: `processed / total`, `ready` umfasst bestehende und neue native Waveforms. Die Summe schrumpft nicht nach einem vorgeschalteten Gesamtdurchlauf. Beim Wiederaufnehmen werden bestehende Waveforms gezählt und ihre Decoderarbeit übersprungen.

**Vergleichbare Messung unter Node 22.23.3:** derselbe ungestörte Batch mit sofortigen Cache-/Decoder-Doubles, kein Gerätetiming. Drei korrekte Begrenzungstests scheiterten vorher mit genau doppelt so vielen Cache-Aufrufen.

| Songs | Cache-Aufrufe vorher | Cache-Aufrufe nachher | Decoder-Anfragen vorher/nachher |
| ---: | ---: | ---: | ---: |
| 500 | 1.000 | 500 | 500 / 500 |
| 2.000 | 4.000 | 2.000 | 2.000 / 2.000 |
| 5.000 | 10.000 | 5.000 | 5.000 / 5.000 |

Damit sind 50 % weniger Cache-Funktionsaufrufe in diesem Fall belegt, kein halbierter Scan und kein CPU-/Akkuprozentwert. Die Decoder-Doubles liefern hier bewusst kein Ergebnis; Cachehits und echte Contention werden separat geprüft. Rohzähler mit Methodik stehen in `docs/review/codex-v3-waveform-cache-counts-2026-10-11.json`.

**Prüfung:** 378 Suiten / 3.777 Tests unter Node 22 bestanden; Coverage 93,53 % Statements / 85,61 % Branches / 95,34 % Functions / 95,97 % Lines. Typecheck, Lint ohne Warnungen und Komplexität bestehen. Die drei ursprünglichen Counterregressionen, Cachehit ohne Decoder/Historywrite und erneute Cacheprüfung nach Contention bestehen. Bestehende Speichertimeout-, Abbruch-, Decoderfehler- und Resumeprüfungen bestehen im Gesamtlauf. Gerätewerte bleiben offen.

Der frische Produktions-Hermes-Export besteht die Dependency-Boundary mit 1.611 Quellen; ein anschließend separat erzeugtes Androidprojekt besteht die Manifestpolicy. Keine Dependency-/Scriptänderungen wurden dabei in den Commit übernommen. Die APK zu `9f450f4` bleibt ein Buildnachweis des früheren Scan-Pakets und enthält diesen Fix noch nicht.

**CI-Nachtrag:** Das veröffentlichte F16-Paket `9705dcc3bbbcd259f85c92d181642c9ecd6a7324` besteht CI-Lauf [38155003004](https://github.com/k1w1-a0style/musik-player/actions/runs/38155003004) vollständig. Der vorherige MP4-Lauf wurde durch die vorhandene Concurrency abgebrochen; das ist kein eigener nativer Erfolgsnachweis.

## Paket 6: Sichtbarer Fortschritt und lokaler Sleep-Countdown (F13/F14)

Ausgangspunkt: `9705dcc3bbbcd259f85c92d181642c9ecd6a7324`. Keine Speicherformatmigration.

**F13:** Periodische native Progress-Reads laufen nur bei sichtbarer Wiedergabe im Vordergrund. Pause erhält einen Snapshot und aktualisiert anschließend auf bestätigtes Seek, Trackwechsel und native Heartbeats. Rückkehr oder erneute Sichtbarkeit aktualisiert sofort. Heartbeats liefern ihren eigenen Wert ohne zusätzlichen Read. Ein laufender Read wird nicht überlappt; periodische Ticks werden nicht aufgestaut. Ereignisse während eines Reads bündeln höchstens eine weitere aktuelle Abfrage. Revisionen verhindern, dass ein alter Read einen neueren Heartbeat überschreibt. Cleanup entfernt Timer, Listener und Seekabonnement und unterbindet spätes Publish. RNTP-Readiness, native Writer-Acknowledgements, Audio- und Remote-Service bleiben zuständig.

**F14:** Der NowPlaying-Kontext enthält den stabilen Sleep-Deadlinewert. Nur die sichtbaren Header-/Menüanzeigen betreiben einen Sekundenclock; bei Hintergrund oder ausgeblendeter Anzeige endet dieser. Rückkehr berechnet den Rest aus der tatsächlichen Deadline. Start, Abbruch, native Expiry und Ersatz eines Timers bleiben im bestehenden Controller.

**Vergleichbare Zähler unter Node 22.23.3:** jeweils 30 Sekunden mit derselben 500-ms-Cadence; der initiale Snapshot ist ausgeschlossen. Pause: 60 → 0 periodische Reads. Hintergrund: 60 → 0. Rückkehr: weiterhin genau 1 Snapshot. Sichtbare Wiedergabe behält 60 Reads. Der Sleep-Countdown führte vorher zu 30 Provider-Rendern und verändertem Kontextobjekt; nachher zu 0 Rendern bei identischem Kontextobjekt. Der Fakeclock wurde in 30 getrennten React-Acts fortgeschaltet, um irreführendes Batching zu vermeiden. Rohzähler und Methodik: `docs/review/codex-v3-progress-sleep-counts-2026-10-11.json`. Das sind Host-/Boundary- und Rendernachweise, keine Gerätegeschwindigkeit oder Akkumessung.

**Regressionen und Gates:** 380 Suiten / 3.794 Tests bestehen vollständig; Coverage 93,55 % Statements / 85,62 % Branches / 95,33 % Functions / 95,99 % Lines. Der erste Lauf hatte genau einen älteren Hook-Aufruf-Vertragstest; dessen Erwartung wurde auf den neuen Sichtbarkeitsparameter korrigiert, anschließend bestand der komplette Wiederholungslauf. Die beiden frischen Zählersuiten bestehen separat mit 46 Tests. Typecheck, strenger Lint, Source-NUL und Komplexität bestehen; Produktions-Hermes-Export samt Dependency-Boundary umfasst 1.615 Quellen. Der anschließend separat erzeugte Prebuild besteht die Manifestpolicy; package.json und Lockfile bleiben unverändert.

**Grenzen:** Der bestehende VirtualizedList-Test meldet eine React-Act-Warnung; sie wurde nicht unterdrückt und ist keine bestätigte Produktionsstörung. Native Pause-/Seek-/Hintergrund- und Geräteabnahme dieses Pakets bleiben offen. Die vorhandene Preview-APK gehört weiterhin ausschließlich zum früheren Paket 3.

## Paket 7: Begrenzte History, wiederverwendete Sortierschlüssel und Speicherbudgets (F15/F20/F21)

Ausgangspunkt: `ecf7c1efa9bcf52c6aba6cc9f6565ddb138cd574`. Bibliotheksformat v2 und historische Fingerprints v1 bleiben lesbar; keine Song-ID-, Playlist- oder Audio-Migration.

**F15:** Optionale Completion-History bündelt abgeschlossene, bereits dauerhaft gespeicherte Waveforms in 32er-Batches, kleine Restmengen spätestens nach einem Sekundenclock. Der explizite Durable-Barrier, Hintergrund und Provider-Unmount flushen ausstehende History. Der bestehende serialisierte Write-Tail bleibt erhalten: ein alter nativer Write kann nicht durch Timeout/Reset freigegeben werden; Completion während eines Writes ist vor dessen Barrierabschluss enthalten. Fehler lassen die Version dirty und damit wiederholbar. History beweist weiterhin keine Cache-Verfügbarkeit.

History und Status registrieren höchstens 10.000 nicht benötigte Einträge; ein ready Bibliotheksstand bereinigt nicht mehr passende Quellenrevisionen. Sichtbar abonnierte Zeilen und laufende Analysen behalten ihren Besitz bis zu dessen tatsächlichem Ende. History wird schon vor JSON-Parse auf eine Million Codeeinheiten begrenzt. Späte Hydration berücksichtigt die aktuelle Retentionmenge und übernimmt neue lokale Completions zuletzt. Entfernte Revisionen werden auch aus dem nächsten gespeicherten History-Snapshot entfernt. Die Retention identifiziert pro unverändertem Song dessen kompatible Quellen nur einmal; schwache Songmerkmale dienen nicht zur Zuordnung. Audio- und Waveform-Payloads werden dadurch nicht gelöscht.

| Titel im identischen seriellen Hostfall | History-Writes vorher → nachher | Serialisierte UTF-16-Codeeinheiten vorher → nachher |
| ---: | ---: | ---: |
| 500 | 500 → 16 | 4.885.250 → 169.276 |
| 2.000 | 2.000 → 63 | 78.041.000 → 2.515.407 |
| 5.000 | 5.000 → 157 | 487.602.500 → 15.478.165 |

Alle 5.000 Quellen bleiben im bestätigten letzten Snapshot. Der Benchmark verwendet den echten Store und seriellen Orchestrator mit unmittelbaren I/O-Doubles. Er speichert nur Aggregatzähler und den letzten Snapshot; Jest hält keine quadratische Menge alter Snapshotstrings fest. Eine separate Ausführung des ursprünglichen und neuen Statusmoduls bietet jeweils 10.005 inaktive Status an: vorher bleiben 10.005, nachher 10.000. Das ist eine Eintragszählung, kein Android-RAM-Messwert.

**F20:** Anzeigetitel, Künstler, führende Jahreszahl und Importdatum werden je unverändertem Songobjekt schwach referenziert wiederverwendet. Änderungen erzeugen bereits im bestehenden Bibliotheksvertrag neue Songobjekte und damit neue Keys; entfernte Objekte werden durch den Cache nicht gehalten. Album-Disc-/Trackwerte und Gruppen-Sortiertitel sind ebenfalls gecacht. Gemeinsame deutsche Collatoren ersetzen wiederholtes `localeCompare` mit Optionen; die jeweilige Numeric-/Tie-/Missing-Semantik bleibt erhalten. Suchschlüssel waren schon per WeakMap gecacht und wurden nicht doppelt implementiert. Albumidentität wird weiterhin aus der tatsächlichen Collection aufgelöst.

Beim ersten Alphabetlauf werden Anzeigetitel vorher 7.610 / 37.172 / 109.452-mal für 500 / 2.000 / 5.000 Titel abgeleitet; danach genau 500 / 2.000 / 5.000-mal. Eine wiederholte Sortierung benötigt danach keine neue Ableitung. Collation bleibt notwendig, verwendet aber den vorhandenen Collator statt einer erneuten Optionenauflösung. Einzelne Hostzeiten stehen im Rohbericht; es gibt daraus keine Median- oder Gerätegeschwindigkeitsbehauptung. Tests prüfen geänderte Titel/Jahre/Importdaten und die unveränderte Track-/Albumreihenfolge.

**F21:** Gesamtbudget 16.777.216 UTF-16-Codeeinheiten für den serialisierten Bestand (ungefähr 32 MiB Stringdaten), 524.288 für ein Manifest, höchstens 4.096 Chunkreferenzen und weiterhin 128 Ki je Chunk. Manifestgröße wird vor Parse geprüft, Summen und Metadaten vor `multiGet`/Join, Write-/Referenz-/Manifestbudgets vor neuen nativen Writes. Ein übergroßer Ersatz lässt das bereits bestätigte Manifest und dessen Chunks erhalten. Ein valider aktueller Bestand liest keine unnötige alte Legacykopie. Korruptes Chunkmaterial darf nur auf eine begrenzte, durch den Manifestchecksum bestätigte Rückfallkopie zurückfallen; ein ungültiges Manifest darf keinen beliebigen alten Bestand wiederbeleben. Fehler werden kontrolliert an die vorhandene Recovery-/Hydrationanzeige weitergegeben. Die native Übertragung eines einzelnen `getItem`-Strings selbst kann die JS-API nicht vorher begrenzen.

Vorher verursachten vier absichtlich ungültige Metadatafixtures jeweils einen Chunkread. Danach null; ein übergroßes Manifest wird zusätzlich ohne JSON-Parse abgelehnt. Die übergroße Write-/Legacy- und vorhandene Daten-/Unicode-/Rückfall-/Revisionsprüfung bleibt erhalten. Rohdaten aller drei Befunde: `docs/review/codex-v3-history-sort-storage-counts-2026-10-11.json`.

**Prüfung:** Frischer vollständiger Node-22-Lauf: 385 Suiten / 3.818 Tests, Coverage 93,58 % Statements / 85,71 % Branches / 95,34 % Functions / 96,00 % Lines. Ein vorhandener History-Test erwartete zunächst einen unmittelbaren Write; er nutzt jetzt die explizite bestätigte Barrier, während der neue Fakeclocktest die Sekundenbündelung unabhängig prüft. Die Manifestvalidation wurde zum Bestehen des bestehenden Komplexitätslimits in kleine Header-/Referenzprüfungen zerlegt. Typecheck, strenger Lint, Source-NUL und Komplexität (3.543 Funktionen) bestehen. Produktions-Hermes-Export/Boundary: 1.616 Quellen; anschließender separater Prebuild besteht die Manifestpolicy. Dependencies und Lockfile unverändert.

**Offen:** F17/F18/F19, Oberfläche, Backup/Resume sowie echte Geräte-/A50-Messungen und native Abnahme des vollständigen V3-Stands. Keiner dieser Punkte wird durch Hostzähler als erledigt dargestellt.

**CI-Nachtrag Paket 6:** Commit `ecf7c1efa9bcf52c6aba6cc9f6565ddb138cd574` besteht CI-Lauf [38157196683](https://github.com/k1w1-a0style/musik-player/actions/runs/38157196683) vollständig. Dies ist weiterhin keine Emulator-/A50- oder Previewabnahme des Gesamtplans.

## Paket 8: Speicherbestätigung vor optionalem Cover-Cleanup (F19)

Ausgangspunkt: `6940973eaa4af2cbcfd2e1b74398a01b113c8a95`. Kein Daten- oder Cacheformatwechsel.

Ein tatsächlich bestätigter `stored`-/`unchanged`-Snapshot schließt jetzt den sichtbaren Speichervorgang ab, während optionales Cache-Cleanup weiterläuft. Der Cover-Lease behält seinen In-flight-Owner bis zum echten Ende des Cleanup-Promises. Unmount/Cancel eines bereits abgeschlossenen Writes kann diesen Schutz nicht vorher freigeben. Ältere Cleanupabschlüsse senken die zuletzt bestätigte Generation nicht. Unbestätigte oder überholte Writes starten weiter kein Cleanup; ihre bisherigen Provision-/Recovery-Handoffs bleiben erhalten. Der native/Filesystem-Cleanup behält seine vorhandene Zusammenfassung auf die neueste Anforderung und die Prüfungen unmittelbar vor Löschungen.

Cleanupfehler, einschließlich eines synchronen Dispatchfehlers, werden als Wartungsfehler protokolliert und verwandeln keine bestätigte Speicherung in einen Speicherfehler. Es gibt keine frühe Freigabe einer noch laufenden nativen Mutation. Der neue Kontrollfluss entkoppelt den Speicherabschluss, nicht den tatsächlichen Schutzbesitz.

**Vergleichbarer Lifecycle-Nachweis:** gleiche bestätigte Persistenzfixture und ausdrücklich noch ungelöstes Cleanup; nach 20 Microtasks war die Task vorher in beiden Fällen (`stored`, `unchanged`) weiterhin offen. Nachher ist ihr bestätigtes Ergebnis verfügbar, während die Protection unverändert gehalten wird. Die zwei korrekten neuen Solltests scheiterten vor dem Fix. Weitere Tests prüfen Cancel, unterschiedliche Abschlussreihenfolge, synchrone/asynchrone Cleanupfehler und einen verspäteten, überholten Write. Rohbeleg: `docs/review/codex-v3-cover-cleanup-lifecycle-2026-10-11.json`. Es wird daraus kein Gerätezeit-, RAM- oder I/O-Prozentwert abgeleitet.

**Prüfung:** Node 22.23.3, 386 Suiten / 3.824 Tests vollständig grün. Coverage 93,62 % Statements / 85,72 % Branches / 95,34 % Functions / 96,04 % Lines. Die vier betroffenen Lifecycle-/Persistence-/Cleanup-Suiten bestanden vor dem zusätzlichen synchronen Fault-Injectionfall mit 54 Tests; der folgende Gesamtlauf enthält alle sechs neuen Fälle. Typecheck, strenger Lint, Komplexität (3.546 Funktionen) und Source-NUL bestehen. Frischer Produktions-Hermes-Export/Boundary: 1.616 Quellen; anschließend separat erzeugter Android-Prebuild besteht das Manifest-Gate. package.json/Lockfile unverändert.

**Offen:** Echte langsame Provider, rasche Import-/Coveränderungen und Geräte-RAM/Frames müssen in der abschließenden Geräteabnahme geprüft werden. F17/F18 und die folgenden Funktions-/UI-Pakete bleiben in Arbeit.

**CI-Nachtrag Paket 8:** `2814fc360404f05fb0b36edcc73a7d2d98631f44` besteht Lauf [38159397478](https://github.com/k1w1-a0style/musik-player/actions/runs/38159397478) vollständig. Der vorherige Paket-7-Lauf wurde durch Concurrency abgebrochen; seine Änderungen sind im erfolgreichen Paket-8-Stand enthalten.

## Paket 9: Nachgewiesene Altpfade entfernen (F22)

Ausgangspunkt: `2814fc360404f05fb0b36edcc73a7d2d98631f44`. Entfernt wurden der unerreichbare CoverPagerTrack, die ausschließlich in Tests verwendete songPreparation-Fassade sowie die ungenutzte horizontale Motion-Implementierung. Der aktive horizontale FlatList-Carousel und die vertikale Player-/Queuebewegung bleiben erhalten. Ebenfalls entfernt: applyNativeEqualizerBands (der aktive Scheduler bleibt), useWaveformProgress (die aktive Progressabfrage bleibt), dismissWaveformPreparation, SONG_ROW_HEIGHT, getTrackPageKeys, BASS_PULSE_STEP_MS sowie die danach ebenfalls unerreichbaren Swipe-/Dateiwrite-Helpers.

useImportFileProgress wird tatsächlich von LibraryImportStatus verwendet und bleibt erhalten. Der Cache-Verfügbarkeitsprobe dient weiterhin einem echten History-vs.-Cache-Vertragstest. Native Registrierungen, Readiness-/Compatibilitypfade und aktive Styles von SongCard/LibraryImportStatus bleiben erhalten. Die statische Importanalyse allein rechtfertigt keine Entfernung öffentlicher oder dynamisch registrierter Funktionen.

Netto entfallen 369 Produktionszeilen und 386 ausschließlich den Altpfaden zugehörige Testzeilen; der Komplexitätscheck zählt 3.546 → 3.497 Produktionsfunktionen. Die vergleichbaren Produktions-Hermes-Exports umfassen 3.617.016 → 3.607.924 Bytes, also 9.092 Bytes weniger. Dies ist keine gemessene Start-, CPU- oder RAM-Verbesserung. Rohbeleg: `docs/review/codex-v3-deadcode-removal-2026-10-11.json`.

**Prüfung:** Vollständiger Node-22-Lauf: 385 Suiten / 3.800 Tests, Coverage 93,69 % Statements / 85,76 % Branches / 95,51 % Functions / 96,05 % Lines. Die niedrigere Testzahl entsteht ausschließlich aus der Entfernung von Tests unerreichbarer Implementierungen. Typecheck, strenger Lint, Source-NUL, Komplexität, Produktions-Hermes-Export und Dependency-Boundary (1.616 Quellen) bestehen. Ein separater frischer Android-Prebuild besteht die Manifestpolicy. Der von Expo automatisch geänderte Android-Startscript wurde auf den bestätigten bisherigen Wert zurückgestellt; Dependencies und Lockfile unverändert. Native Navigation-/Player- und Geräteabnahme des Gesamtstands bleiben offen.

**CI-Nachtrag Paket 9:** `1fa3acf35c3f2a9e19c844ad0855d5a2794c681a` besteht [38160601008](https://github.com/k1w1-a0style/musik-player/actions/runs/38160601008) vollständig.

## Paket 10: Gemeinsamer Import-Reader und konsistente Thumbnails (F17/F18)

Ausgangspunkt: `1fa3acf35c3f2a9e19c844ad0855d5a2794c681a`. Audioinfo und optionales Artwork teilen jetzt eine scoped MediaMetadataRetriever-Instanz; der MediaExtractor für Kanal-/Sampleratedaten bleibt erforderlich. Die vollständige begrenzte JS-Tagprüfung bleibt erhalten. Vorhandenes parsed Artwork und deaktivierte Cover vermeiden den zusätzlichen Artwork-Read. Beide Importwege (MediaLibrary und SAF) nutzen denselben Snapshot; ältere APKs ohne diese optionale API behalten den bisherigen Vertrag. Manual-Metadatenrefresh bleibt ein eigener benötigter Pfad.

Ein ausgelassener, fehlgeschlagener, übergroßer oder nicht unterstützter neuer Artwork-Read bleibt `checked:false`. Nur eine tatsächlich abgeschlossene leere Untersuchung bestätigt Abwesenheit. Der Consumer hält den nativen Staging-Lease durch permanente Coverkopie und Abbruchprüfung; verspätete Bridgeergebnisse werden an der Safetyboundary freigegeben. Es gibt keine neue native Parallelität und keine vorzeitige Freigabe eines noch laufenden Reads. Der native Factory-/Ownershiptest vergleicht zwei bisher getrennte scoped Reads mit einem gemeinsamen Reader. Dies zählt Readerinstanzen im nativen Test, keine OEM-internen Dateiöffnungen oder Android-Zeit-/CPUwerte; sein CI-Ergebnis ist bis zum nativen Lauf offen.

**F18:** Gruppenzeilen verwenden wie Songzeile/MiniPlayer die bestehende 128-Pixel-Thumbnailanforderung, mit Original und anschließend Buchstabe als Fehlerfallback. Coverwechsel setzt die Fehler zurück. Native Displayvarianten behalten Bounds-, Revision-, Atomicpublish- und Originalschutz. Ein Cachemiss reserviert vor Publish einen Platz und das tatsächlich komprimierte Bytebudget. Ist die jüngste Handoff-Grace bereits voll, wird der neue Thumbnail verworfen und das Original angezeigt. Damit wächst ein frischer Cacheburst nicht weiter über 256 Varianten / 32 MiB; native temporäre Dateien sind zusätzlich pro Einzelbild begrenzt. Bereits vor dem Update übergroße, noch frische Bestände werden unter Beachtung der bestehenden Grace bereinigt und wachsen nicht weiter. Das ist keine Behauptung eines sofortigen harten Limits für jeden alten Cachezustand.

Die bisherige globale Decodesperre und zwei Worker bleiben bestehen: Ohne vergleichbare Geräte-Contention-/Framesmessung rechtfertigt der Scan keine riskante Parallelisierung. Neue echte Bitmap-/Filesystemtests prüfen Countbudget im Burst, Bytebudget, Temporarycleanup und unbeschädigte Originale; ihre Android-CI-Ausführung bleibt bis zum Lauf offen. RAM, Scrollframes und Slowproviderwerte bleiben Teil der Geräteabnahme.

**JS-Prüfung:** 386 Suiten / 3.812 Tests vollständig grün; Coverage 93,71 % Statements / 85,80 % Branches / 95,54 % Functions / 96,08 % Lines. Acht neue gemeinsame Importtests prüfen beide Quellen, fehlende/ausgeschaltete Artworkprüfung, fehlgeschlagene Kopie, Abbruch und verspätete Per-file-Ergebnisse. Drei Bridgefälle prüfen Older-APK, Timeout-/Leasecleanup und Fehler. Der Testdatensatz wurde anschließend um die vollständigen Assetpflichtfelder ergänzt und seine acht Fälle erneut bestanden. Typecheck, strenger Lint, Source-NUL (1.000 Dateien), Komplexität (3.498 Funktionen), Hermesexport/Boundary (1.616 Quellen) und separat generierte Manifestpolicy bestehen. Kein Dependency-/Lockfilewechsel. Native Compile-, Reader-/Cachetests und reale Geräteabnahme folgen; F11/F12 sowie gewählte UI-, Backup- und Resumefunktionen sind noch offen.

**Nativer CI-Nachtrag:** Lauf [38171143863](https://github.com/k1w1-a0style/musik-player/actions/runs/38171143863) zu `0a3e7f46f29c0f032826eebaaff2295fa73decf0` besteht alle JS-/Audit-Gates und kompiliert den neuen Androidcode. Von 168 SystemAudio-Tests scheitert ausschließlich die bisherige exakte Methodeninventarliste in NativeDispatchQueueTest: extractImportSnapshot fehlt in deren Erwartung. Alle sechs neuen Reader-/Bitmap-/Cachetests bestehen in diesem Lauf. Der Follow-up ergänzt die Inventarerwartung; die wichtige Prüfung, dass jede erfasste Bridgefunktion ausschließlich über MAIN an begrenzte Worker dispatcht, bleibt unverändert. Der gesamte native Lauf ist bis zur erfolgreichen Wiederholung ausdrücklich nicht grün.
