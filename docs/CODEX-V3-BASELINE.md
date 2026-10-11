# Arbeitsplan V3 – Baseline und Prüfgrenzen

Stand: 11.10.2026. Repository `k1w1-a0style/musik-player`, ausschließlich Branch `codex`.

## Gesicherter Ausgangspunkt

- Ausgangs-Commit: `a1725abb0050bc64cb4b3445624f382658eca8fc`.
- Der Arbeitsbaum war vor den Änderungen sauber. Keine offenen Pull Requests beim Start.
- Alle 965 Dateien des bereitgestellten ZIP stimmen mit diesem Commit überein. Der ZIP-Befundkatalog F01–F25 gilt daher auch für diesen Ausgangspunkt; Geräte- und Performancehypothesen bleiben Hypothesen.
- Backupbranch: `backup/codex-before-plan-v3-20261009-a1725abb`, auf demselben Commit. `main` wurde nicht verändert.
- Erneuter Remote-Abgleich am 11.10.2026: `codex` steht weiterhin auf diesem Commit.

## Tatsächlich ausgeführte Baseline

- Node 22.23.3, reproduzierbares `npm ci`; der RNTP-V5-Postinstall-Patch bestätigt vier gepatchte Dateien für Version 5.12.1.
- Bestehende Jest-Suite: **371 Suiten, 3.688 Tests bestanden** unter Node 22, vor den Fixes und ohne neue Regressionen.
- Sieben neue Tests erwarten korrektes Verhalten und scheiterten zunächst alle: getrennte case-sensitive Provider-IDs, unabhängige Dateien mit gleichen schwachen Dateimerkmalen, Album-Trackfolge, Discfolge, getrennte Künstleralben, bestätigte Tag-/Coverentfernung und einheitliche Änderungszeiten.
- Bestehende CI für den Ausgangspunkt: [Run 37857575547](https://github.com/k1w1-a0style/musik-player/actions/runs/37857575547), erfolgreich. Dies ist kein Buildnachweis für spätere Änderungen.

## Performance-Ausgangswerte und Grenzen

Der frühere Full-Scan maß den unveränderten ZIP-Code auf dem Host unter Node 24 mit unmittelbaren Provider-Doubles. Drei Durchläufe je Fall, Median:

| Unveränderte Titel | Provider mit Datum | Provider ohne Datum |
|---|---:|---:|
| 500 | 300 ms | 299 ms |
| 2.000 | 1.208 ms | 1.196 ms |
| 5.000 | 2.986 ms | 2.997 ms |

Der echte JS-Importpfad fragte pro Titel nur den Provider-Stat ab; kein Audio-Stream, Tagread, Coverread oder Song-Checkpoint bei unveränderten Quellen. Ohne Datum wurden wiederverwendete Quellen ausdrücklich als unbestätigt gezählt. Diese Werte messen **keine reale Android-I/O, RAM-Nutzung, Scrollframes, Akkuwerte oder A50-Geschwindigkeit**. Sie sind außerdem kein Node-22-Vorher-/Nachhervergleich für die neuen Fixes.

## Verfügbare Prüfmittel

Lokale Node-22-Gates, Jest/Coverage, Typecheck, ESLint, Komplexität, Source-NUL, Expo-Konfiguration, Manifest-/Bundleprüfung und die verbundene GitHub-CI sind verfügbar. Ein lokales physisches Android-Gerät beziehungsweise A50 ist nicht verbunden; lokale ADB-Geräteabnahme ist daher nicht erfolgt.

Der Limrun-Connector ist erreichbar. Am 09.10.2026 wurden keine laufenden Instanzen gemeldet. Zwei vorhandene ältere Musikplayer-APKs gehören zu anderen Commits und werden nicht als Nachweis für den aktuellen Stand verwendet. Ein neuer passender Build muss vor einer neuen Emulatorprüfung erstellt, zugeordnet und installiert werden.

## Datenmigration und Produktgrenzen

Bereits früher zusammengefallene Bibliothekseinträge werden nicht anhand von Dateinamen automatisch aufgespalten. Ein erneuter Quellscan kann unabhängige Dateien künftig getrennt aufnehmen. Bestehende Song-IDs sowie Playlist-/Favoritenreferenzen bleiben bei nachgewiesenen Reimports erhalten.

Backup/Wiederherstellung wird in den Einstellungen umgesetzt; Resume erhält einen echten Ein/Aus-Schalter mit Standard Aus. Lesezeichen, eigene Kapitel und CUE-Kapitelimport bleiben ausgeschlossen. Die übrigen Ideen sind Backlog, keine pauschale Featurefreigabe.
