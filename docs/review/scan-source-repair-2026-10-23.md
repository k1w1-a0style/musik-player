# Scan-Quellen und Reparatur – Implementierungscheckpoint 23.10.2026

Arbeitsbranch ausschließlich codex. Main-Referenz b62b91b59c7400fd310a5db8fcbf9fc6444ff393.

## Implementiert

- Explizite Quellenwahl vor Schnellscan und vollständigem Scan: Android-Musikbibliothek, aktive Scan-Ordner oder beide. Keine automatische zusätzliche Quelle nach einem Lesefehler. Wiederholen verwendet dieselbe Quelle.
- Beide Quellen laufen nacheinander mit frischer gespeicherter Bibliothek, kumulierten Fortschrittswerten und dauerhaftem Teilfehlerstatus. Ein Quellenfehler verhindert die andere ausdrücklich gewählte Quelle nicht; Abbruch beendet beide.
- Eindeutige Android-ExternalStorage-Dokumente und MediaStore-Datei-URIs werden anhand von Volume und Pfad zusammengeführt. Der primäre Pfad stammt aus Androids aktuellem Benutzerprofil, nicht aus einem fest geratenen /storage/emulated/0. Andere Provider, Dateinamen und Pfadtraversal werden nicht als Identitätsbeweis verwendet.
- Erneute erfolgreiche SAF-Dateiprüfung aktualisiert die zugängliche URI einer belegbar identischen Datei; Titel-ID, Playlist-Verweise und Nutzermetadaten bleiben erhalten.
- Dateiimport-/Timeoutfehler erscheinen am zugehörigen Ordner; folgende fehlerfreie Ordner erben den Fehler nicht. Ordner- und Dateidiagnosen bleiben getrennt, Originalfehler werden weitergegeben. Nicht enumerierte Ordnerinhalte werden ausdrücklich als unbekannt bezeichnet.
- Leere Auswahl zeigt keine wirkungslosen Massenaktionen, Ausstieg bleibt erreichbar. Scanmenü und Ergebniszeile unterstützen Umbruch und begrenzte Bildschirmbreite.
- Neue Testversion 1.0.1 / Android-Versioncode 2; bestehende Paketidentität und Testsignatur bleiben vorgesehen.

## Security

GHSA-mrhx-c7xc-m3w5 neu am 23.10. in der CI erkannt. Zod auf echte veröffentlichte Version 4.6.6 aktualisiert, auch der isolierte Expo-CLI-Verbraucher verwendet diese Version. Die beiden tatsächlichen CLI-Schemamodule werden mit gültigen/ungültigen Plugin-, Ausgabe- und MCP-Eingaben geprüft; eine übergroße begrenzte Sammlung erzeugt keine Fehlerobjekte je Element. Clean npm ci erfolgreich.

Frische vollständige und Produktionsaudits: 0 Critical, 4 High, 0 Moderate. Eine node-forge-Wurzel und drei transitive Effekte. Unveränderte Policy verweigert weiterhin wegen Ablauf 21.10.2026; keine Ausnahme verlängert, kein Gate geändert. Node-forge 1.4.0 und Zertifikatspaket 0.0.7 weiterhin aktuell. Kein veröffentlichter Forge-Fix laut GHSA-86w9-cpqp-85rv. Braces ist nicht mehr im aktuellen Audit.

## Abnahme offen

Gezielte Scan-, Auswahl-, Regrant-, Integrations- und Zod-Tests erfolgreich; TypeScript, ESLint, Komplexität und Expo-Kompatibilität bestanden; 182 Python-Regressionen bestanden. Vollständiger Jest-Lauf und neue Exact-APK-/Native-/CI-/Emulatorabnahme werden nach diesem Checkpoint ausgewertet. Historische APK-Abnahmen gelten nicht für diese geänderte APK. Keine Freigabe und keine Issue-Schließung durch diesen Zwischenstand.
