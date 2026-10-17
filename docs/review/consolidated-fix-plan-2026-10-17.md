# Konsolidierter Arbeitsplan und Befundabgleich – 17.10.2026

Ausgangspunkt: `codex` / `151f8c6774790e6dee46daa168175d2d558f02ea`.
Rückfallreferenz: `backup/codex-before-consolidated-fixes-20261017`.
Grundlage: angehängte konsolidierte Review (17 Seiten). `main` bleibt unverändert.

## Verbindliche Reihenfolge

1. **SEC-01/02:** Lockfile, aktuelle npm-Advisories, kompensierende Patches und Android-Bundle prüfen. Keine Verlängerung der Frist 21.10. und keine schwächeren Gates. Ohne kompatibles Upstream-Fix bleibt dies ein expliziter Releaseblocker.
2. **UI-01/04:** echte 48-dp-Touchflächen für Cleaner und Playlist. Schriftabhängige Playlist-Zeilenhöhe gemeinsam für Layout, Drag, Vorschau und Autoscroll verwenden.
3. **UX-02/04 und Datenintegrität:** Auswahl über Quellentabs erhalten, Suche hinzufügen, sichtbare/globale sichere Auswahl trennen, globale Feldfreigaben bis zum Writer erhalten; exakte Änderungsbestätigung.
4. **UX-01/03, SAFE-01:** vorhandenen Cleaner prominent öffnen, Vorschau zuerst zeigen, Filter einklappen, Anzeige-/Dateimodus und fehlendes Musikdatei-Backup eindeutig erklären.
5. **UI-02/03, UX-07:** kompakte Einstellungsgruppen, eine Palette mit drei unabhängigen Zielen, echte Neutral-Vorschau, sichtbarer Speicherfehler mit Retry.
6. **UX-05/06:** strukturierte bestätigte Prozesszustände, Teilabbruch-Zähler, reduzierte Bewegung, virtualisierte und filterbare Ergebnisse mit Titeln.
7. **PERF-02, CI-01/02:** 1k/5k/10k deterministische Profilierung; Legacy-Retest kennzeichnen und aktuelle Manifest-Route dokumentieren; Prüftreiber nur mit unverändertem Verhalten modularisieren.
8. **Regression und Integration:** passende Teiltests nach jeder Änderung; danach TypeScript, ESLint, Complexity, komplette Jest-Coverage, Python-/Security-Checks, Android-Bundle, eine Source-CI mit neuer APK und zugehöriger Emulatorabnahme.
9. **DEV-01/PERF-01/BR-01:** tatsächliche OEM-/SD-/Cloud-/Bluetooth-/TalkBack-Prüfung und 10/25/50-MiB-Provider-Messung separat offenhalten, wenn keine Hardware verfügbar ist. Freigabe/Merge erst nach belegter Abnahme.

## Geschützte Invarianten

- SAF-Writer, Quellhash, Journal, bestätigte Library-ACKs, Recovery und Queue-Sperren bleiben erhalten.
- Kein Auto-Retry von Dateischreibungen, keine Unterbrechung mitten im nativen Commit.
- Backup/Restore bleibt in Einstellungen; Wiedergabe fortsetzen bleibt abschaltbar.
- Bestehende Farb-/Backup-IDs und Hintergrund-/Safe-Area-Fix bleiben kompatibel.
- Browser-/DOM-/WebAudio-Behauptungen werden gemäß Review verworfen.

## Nachweisführung

Fortschritt und neu gefundene Defekte werden in `consolidated-fix-results-2026-10-17.md` erfasst. Ein grüner Testlauf ist kein Nachweis realer Gerätefunktion. Historische APK-Nachweise werden keiner neuen Quelle zugeschrieben.
