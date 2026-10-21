# Konsolidierter Deep Scan – Umsetzung und Nachweise

**Aktualisierung22.10.2026:** Gesamtfreigabe weiterhin blockiert. Aktuelle Sicherheitsfristprüfung in [security-expiry-2026-10-22.md](security-expiry-2026-10-22.md); frühere Zahlen unten sind historische17.10.-Zwischenstände. Aktuelle Source-CI siehe letzter Abschnitt.

Basis: `151f8c6774790e6dee46daa168175d2d558f02ea`, Arbeitsbranch `codex`.
Der Arbeitsplan steht in [consolidated-fix-plan-2026-10-17.md](consolidated-fix-plan-2026-10-17.md).
Rückfallbranch: `backup/codex-before-consolidated-fixes-20261017` (auch remote gesichert).

## Befundabgleich

| Review-ID | Änderung / Nachweis | Status |
|---|---|---|
| UI-01/04 | Cleaner-Checkboxen/CTAs, Playlist-Entfernen/Drag mindestens 48 dp. Schriftabhängige Playlist-Zeilenhöhe gemeinsam in Zeile, Drag, Vorschau und Autoscroll. | Code und Hosttests grün; neue native Font2-Prüfung ergänzt |
| UX-01 | Direkter Bibliotheksbutton und Menüeintrag öffnen denselben Cleaner. Startseite mit Tags, Bibliothek/Scan und letztem Lauf. | umgesetzt |
| UX-02 | Sichtbare sichere Auswahl erhält explizite Song-IDs; globale Aktion separat. Zusammenfassung zeigt sichtbare/gesamte/ausgefilterte Auswahl. | Semantiktests grün |
| UX-03 | Vorschau zuerst; Filter/Werkzeuge eingeklappt, Zusammenfassung und Hauptaktion unten. Abschließende virtualisierte Liste mit exakten Feldänderungen und optionalen Quellpfaden. | umgesetzt |
| UX-04 | Suche und über Quellentabs erhaltene, deduplizierte Auswahl. Globale Feldfreigabe bis zu `selectedCleanerTags`/Writer. | Tests grün |
| SAFE-01 | Anzeige bleibt Standard. Dateimodus erläutert fehlendes Dauer-Undo und fehlende Musikbytes im Bibliotheksbackup; zusätzliche Sicherungsbestätigung. Keine improvisierte Undo-Implementierung. | Kommunikation umgesetzt; echte Originalbackups bleiben separater Nutzerworkflow |
| UI-02/03 | Vier kompakte Einstellungsgruppen. Eine Palette mit getrennten App-/Player-/Waveform-Zielen; bestehende IDs/Storageverträge. Neutral-Vorschau aus unakzentuiertem Theme und echtem Renderpfad. | sechs Theme-Kombinationen und Persistenz geprüft |
| UX-05 | Strukturierte Phasen/Zähler statt Fortschrittstext; native/Library-/Journal-ACKs als Fortschrittsgrenze. Teilabbruch, geordnetes Stoppen, Navigation während Arbeit geschützt. Reduzierte Bewegung; Meilensteinansagen. | Abbruch-/Unmount-Tests grün |
| UX-06 | Virtualisierte, filterbare Ergebnisse mit Titel/Interpret, technischen Details auf Wunsch. Datei geändert / Anzeige unbestätigt separat bezeichnet. | 10.000-Einträge-Test grün |
| UX-07 | Persistenzfehler: sichtbare Meldung, bestätigter Rückfall und gezielter Retry. Alte Fehlermeldung darf neuere Auswahl nicht überschreiben. | Retry-/ABA-Regressionen grün |
| PERF-02 | 1k/5k/10k-Hostprofil und virtualisierte Ergebnisse. Fortschritts-ACKs aktualisieren Zähler inkrementell statt das gesamte Journal pro Datei erneut zu scannen. | Hostprofil unten; kein Geräte-FPS-Nachweis |
| CI-01/02 | Legacy-Retest ausdrücklich markiert; moderner Manifest-Retest bleibt bevorzugt. Settingsnavigation und native Cleaner-/Playlist-Geometrie als separat getestete Prüftreibermodule extrahiert. Modus-/Digest-/Source-/Gate-Prüfungen erhalten. | 165 Python-Tests grün |
| FIX-01/02, WEB-01 | Safe-Area-/Hintergrundfix und bisherige Native-/Recovery-Grenzen erhalten; keine Browser-Fixes auf native App übertragen. | Regressionen erhalten |
| SEC-02 | `image-size` weder im Lockfile/Installationsbaum noch im geprüften Android-Export enthalten. Keine erneute Einführung. | aktueller Dependency-Befund erledigt; kein Ersatz für Issue-Verwaltung |
| BR-01 | Kein Merge nach `main`; Rückfallreferenz vorhanden. | eingehalten |

## Zusätzlich gefundene und behobene Folgeprobleme

- Gesperrte Felder hinterließen zunächst einen veralteten Vorschlags-/Konfliktstatus. Status wird jetzt aus dem tatsächlich erlaubten Änderungsumfang neu berechnet.
- Viele feste Aktionszeilen hätten bei großer Schrift die eigentliche Vorschau verdrängt. Zusätzliche Werkzeuge und Auswahlaktionen sind im scrollbaren Header einklappbar.
- Dateibestätigung: Warnung und Sicherungscheckbox scrollen mit; getrennte Touchfläche statt verschachteltem Switch. Vollständige Quellpfade auf Wunsch.
- Ergebnisse nach nativer Änderung und fehlendem Library-ACK werden nicht als vollständig bestätigter Erfolg bezeichnet. Offene Recovery wird nicht als vollständig beendete Dateiarbeit dargestellt.

## Lokale Verifikation

- Erster vollständiger Coverage-Lauf: **434 Suites, 4.177 Tests bestanden**, 96,02 % Zeilenabdeckung, unveränderte Schwellen. Danach ergänzte Änderungen wurden gezielt erneut geprüft; die neue Source-CI muss den exakten Endstand integrieren.
- Letzter fokussierter Lauf: **43 Tests in 6 Suites bestanden**; zusätzliche Feld-/Writer-Regression: **22 Tests in 4 Suites**.
- Python: **165 Tests bestanden**, einschließlich neuer nativer Touchflächen-/Überlappungsprüfungen.
- TypeScript, ESLint ohne Warnungen, Source-NUL-Gate und Complexity-Gate unverändert; keine Schwellen gelockert.
- Android-Hermes-Export erfolgreich; Source-Map-Grenze mit 1.686 Quellen geprüft: `braces`, `micromatch`, `node-forge`, `sprintf-js` gelangen nicht in den App-Bundle. Nach letzten UI-Änderungen wird der Export in der Source-CI erneut erzeugt.
- Produktionsaudit nach identischem CI-Vertrag (`npm audit --omit=dev`): 0 critical, 23 high, 5 moderate; ausschließlich die zwei vorhandenen kompensierten High-Advisory-Wurzeln. Hashgebundene Patches verifiziert, Policy besteht am 17.10.
- Expiry-Negativtest am simulierten 22.10.: beide Ausnahmen werden erwartungsgemäß abgelehnt. Policy und Frist unverändert.

### Reproduzierbares Hostprofil

Ein einzelner lokaler Lauf, synthetische Snapshots, keine native IO, kein Gerätetest:

| Titel | Analyse und Feldmaske | Sichtbare Auswahl |
|---|---:|---:|
| 1.000 | 27 ms | 1 ms |
| 5.000 | 136 ms | <1 ms |
| 10.000 | 191 ms | 1 ms |

Dies beweist keine Android-Framerate, keinen RAM-Grenzwert und keine SAF-Provider-Latenz.

## Offene, nicht durch Code vorgetäuschte Freigabegrenzen

1. **SEC-01:** `braces@3.0.3` und `node-forge@1.4.0` sind am 17.10. weiterhin die aktuellen npm-Versionen. Die offiziellen Advisories nennen keine gepatchte Version. Keine riskante Expo-Rückstufung, kein Major-Jest-Wechsel, keine Fristverlängerung und keine Audit-Abschwächung durchgeführt. Bis einschließlich 21.10. gilt die vorhandene kompensierte Entscheidung; ab **22.10.2026, 00:00 UTC** bleibt die CI ohne neue kompatible Lösung bzw. gesonderte Owner-Entscheidung absichtlich rot. Dieser Zukunftsblocker ist nicht erledigt.
2. **DEV-01/PERF-01:** Physische Samsung-/Huawei-/SD-/Cloud-SAF-/Bluetooth-/Headset-/TalkBack-Abnahme und reale 10/25/50-MiB-Provider-Messung erfordern Hardware. Diese Umgebung hat keinen angeschlossenen Android-Emulator und kein physisches Gerät. Die integrierte CI liefert separat Native-Build-/JUnit-/Emulator-Nachweise.
3. **APK:** Neue Produktbytes benötigen eine neue APK und genau zugeordnete CI-/Emulatorabnahme. Historische erfolgreiche APKs werden nicht als Nachweis dieser Änderung ausgegeben.

Primärquellen zur Upstream-Lage (17.10.2026):
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv

## Integrierte Source-CI

Aktuelle Quelle: `35b3ae2cc785fe38f2997dfd977a18fc5f199df1`, [CI39690780242](https://github.com/k1w1-a0style/musik-player/actions/runs/39690780242).

Qualitätsjob119536649099 erfolgreich: **435Suiten/4195Tests**,174Python, TypeScript, strengerLint, Expo-Kompatibilität, NUL-/Komplexitäts-/Konfigurations-/Manifestgates; Hermes-Bundlegrenze1Map/1688Quellen. Coverage92.94/85.31/94.10/96.03% (Statements/Branches/Functions/Lines). Emulator-Runtimefix zuvor im echten Runner39688915146 erfolgreich bestätigt. Notwendiger SDK57.0.31-Abgleich ist integriert; vorherige Quellen werden nicht als neuer APK-Nachweis verwendet.

Native-/APK-/UI-Abnahme am neuen Stand läuft noch. Die abgelaufenen Sicherheitsausnahmen bleiben unabhängig vom UTC-bedingt noch grünen Anfangsaudit blockierend. Neuer finaler Ablaufcheck schließt Freigabe mit während langer Tests veralteten Ausnahmen. Noch keine vollständige Projekt-/APK-Freigabe.
