# K1W1 Musikplayer – V4-Abschlussstand mit zusätzlichem Hintergrund-Fix

Stand: 16.10.2026. Arbeitsbranch `codex`. Produktive Quelle `f2c46d3742e80655ccf06bc1900811434c4a4686`.

**Zusätzlicher UI-Fix und eigene technische APK-Abnahme bestanden. Der Gesamtauftrag bleibt durch die unten genannten externen Bedingungen begrenzt.**

## Zusätzlicher bestätigter UI-Befund

Der dunkle Streifen oberhalb des Mini-Players war ein Layoutfehler: die eingefärbte Listenfläche endete vor einer äußeren `marginBottom`-Reserve. Das originale Android-XML zeigt die Listen-/Panelgrenze bei y=723 und den Mini-Player ab y=789. An derselben Zeile springen die Bildfarben im Dark Mode um bis zu 14 RGB-Stufen. Im Light Mode ist derselbe Flächenbruch schwächer, aber ebenfalls nachweisbar.

Die Reserve liegt jetzt als Innenabstand in der eingefärbten Panel-View. Dadurch läuft derselbe Hintergrund hinter dem Mini-Player weiter. `Screen` berücksichtigt die untere Safe Area bereits; die Listenreserve zieht diesen Anteil einmal ab und hält genau 20 dp Abstand zum Overlay. Alle sieben Library-Tabs nutzen diese Shell. `FlatList`/Grid behalten `paddingBottom: 0`, es wurde kein zusätzlicher Footer angelegt. Schriftgrößen, Touchflächen und Musikdateien wurden nicht verändert.

## Gezielte Prüfungen vor dem einzigen neuen Build

- Der neue Regressionstest war vor dem Fix rot: 5 Fehler, 2 bestehende Fälle grün.
- Nach dem Fix: 53 Tests in sechs Jest-Suiten grün; Safe Area 0/24/34 dp, gemessene Playerhöhe 64/78/110 dp und genau 20 dp Abstand geprüft.
- Typecheck, betroffene ESLint-Dateien, Source-NUL- und Komplexitäts-Gate bestanden.
- 161 Python-Tests grün. Neue native Geometrie-/Pixelassertions erkennen die alte schwarze Kante, doppelte Safe-Area-Reserve und Überlappungen.

## Neue produktive APK: eigene Herkunft und eigene Abnahme

[CI 38895123158](https://github.com/k1w1-a0style/musik-player/actions/runs/38895123158) gehört exakt zu `f2c46d3742e80655ccf06bc1900811434c4a4686`. Quality-Gate: 429 Jest-Suiten / 4.165 Tests, 161 Python-Prüfungen, 96 % Zeilenabdeckung; Security-Gate erfolgreich mit unveränderten befristeten Kompensationen. Native Build und 178 native Tests ohne Fehler/Skips sind bestanden. Die zwölf gezielten 200-%-Varianten einschließlich Hintergrund-/Inset-Assertions sind im selben Lauf erfolgreich. Anschließend vollständiger Funktionslauf und frische 36/36-Matrix derselben neuen APK erfolgreich. Alle fünf Source-CI-Jobs einschließlich Required release checks sind erfolgreich. Die kritische Sichtkontrolle aller zwölf 200-%-Library-Varianten sowie der 100-/130-%-Übersichten und zweier unverkleinerter Original-PNGs bestätigt den sauberen unteren Hintergrund. Keine historischen Fälle wurden in diese 36 Fälle übernommen.

Die frühere APK `ddcc7ec2` mit SHA256 `2e11157f92a4b09ce39801375ab8f08da42ed3a24a21a7e5dde1b01606afbe2a` und ihre damals 36/36 bestandenen gezielten Fälle bleiben historisch dokumentiert. Der neu bestätigte Hintergrundbefund war von diesen damaligen Assertions nicht abgedeckt. Frühere Ergebnisse werden nicht auf die geänderte APK übertragen. Die noch ältere V5-Originalfreigabe c47b27f6 und ihre archivierten Dateien werden ebenfalls nicht überschrieben.

## Unabhängig geprüfte neue Android-Nachweise

Originalartefakt **12046677232** aus Lauf **38895123158**, Archiv-SHA256 `0d526d33354f945b3b586782fc9c03043d63a1ef799144793b53371f973738b0`. Archivgröße, Digest, ZIP-CRC, eingebettete Source, Harness-Commit und APK-Hash stimmen überein. `font2-regression/stage-result.json` belegt zwölf gezielte Fälle; `release-interaction/result.json` meldet `status: passed` und 36 frische vollständige Matrixfälle. Keine Diagnosefehler, kein FATAL/ANR im geprüften Ergebnis. 144 zugehörige Matrix-PNG-/XML-Paare sind lesbar und zugeordnet.

Alle 48 neuen Panel-Messungen (zwölf gezielte plus 36 vollständige Fälle) halten 30 Pixel = 20 dp Abstand bei 240 dpi. Die bemalte Fläche reicht bis y=924; bei 200 % endet der Scroll-Viewport bei y=759 vor dem Player ab y=789. Der maximale RGB-Kanalsprung an den geprüften unteren seitlichen Listenrändern beträgt **1** (Grenze 3). Vorher: Panelende y=723 und 66 Pixel = 44 dp freier Abstand mit sichtbarem Hintergrundwechsel. Der Hintergrund wird jetzt innerhalb derselben Panel-View gezeichnet.

Der vollständige neue Funktionslauf belegt MediaStore/SAF, native MP3-/M4A-/FLAC-Wiedergabe, Queue-Ersetzung/Drag/Swipe, Resume ein/aus, Hintergrundfortschritt, Playlist-/Favoritenpersistenz, SAF-Backup/Restore mit Rücklesen, 36 Farbauswahlen und beide Player-Layouts, Waveform-Abbruch sowie Cleaner-Lesen/Anzeige und echten Schreibvorgang an einer generierten SAF-Testdatei. Audio-/Cover-/unbekannte Frames bleiben durch Hashes belegt; keine Original-Musikdatei wurde verändert. SoundCloud-Info ist bei 100/130/150/200 % vollständig bedienbar und öffnet TrackInfo.

Maschinenlesbarer Einzelbeleg: `K1W1_V4_UI_Nachweise_f2c46d37.json`. Das separate Nachweisarchiv enthält unveränderte originale GitHub-ZIPs, GitHub-Identitäten, unabhängige Prüfausgabe, Prüferskript, Vorher-Belege und neue Sichtkontrollübersichten. Die neue APK ist eine separat zugeordnete Preview, keine Übernahme der alten V5-/V4-Freigabe.

## Die zwölf Review-Befunde

| ID | Ergebnis | Nachvollziehbarer Beleg / verbleibende Grenze |
|---|---|---|
| F01 – Sicherheitsausnahmen | **Fristlösung offen** | Frische Prüfung vom 16.10., 47 gezielte Jest-Tests und 142 Backport-Fälle, Clean Install und Hermes-Bundlegrenze bestanden. Keine Änderung oder Verlängerung der Ausnahmen; Ablauf 21.10.2026. Offene Advisories/Issue #396 bleiben offen. |
| F02 – V5-Artefakte verfallen | Erledigt | Originale dauerhaft privat archiviert und zurückgelesen; SHA/ZIP/V2-Signatur/Inhaltsdigest bestätigt. Unabhängig vom Actions-Ablauf 14.11.2026. |
| F03 – Cleaner-Journal wächst | Bestätigt und behoben | Serialisierte Epochensicherung, readback-bestätigtes Archiv vor Ersetzung, GC nur eindeutig terminaler Einträge; offene/Legacy/Recovery-/cleanupPending-Belege geschützt. 83 gezielte Journal-/Execution-/Recovery-Tests. |
| F04 – formaler Handoff | Regeln klargestellt; Main-Freigabe offen | Tatsächlich grüne CI und Preview-Abnahme getrennt. Kein Main-Merge autorisiert; nicht erfüllte Head-/Geräte-/Review-Gates bleiben sichtbar. |
| F05 – festes V5-Retestziel | Behoben | Historischen V5-Workflow erhalten; neuer exakter Manifest-Retest prüft Source, Source-Gates, Artefakt, ZIP und APK vor Gerätezugriff. Einzel- und Restmodus ohne neue Builds. |
| F06 – physische Geräte / Provider / TalkBack | **Extern blockiert** | Kein Samsung-/Huawei-/USB-Gerät und keine echte OEM-/Cloud-/SD-/Bluetooth-/Headset-/gesprochene TalkBack-Abnahme verfügbar. Emulatoren sind kein Ersatzbeleg. Issues #234/#236 bleiben offen. |
| F07 – SAF-Hashkosten | Host-Basis ermittelt; **Provider-Messung offen** | Synthetische 10/25/50 MiB: begrenzte 64-KiB-Reads, 160/400/800 Reads, etwa 727/1655/3082 ms auf dem Host. Keine unbewiesene Optimierung, keine Android-CPU/RAM/Jank-Behauptung. |
| F08 – SoundCloud-Infochip | Behoben und auf Android nachgewiesen | Feste Metadatenhöhe/Clipping ersetzt durch natürliche Höhe; mindestens 48 dp, umbruchfähiger Text. Originalnachweise bei 100/130/150/200 %, echte TrackInfo-Navigation, kritische Sichtprüfung. |
| F09 – Dokumentation / Tracker | Behoben | Handoff/Checklist auf SDK 57 / RN 0.86 / lokalen RNTP-5.12.1-Adapter / New Architecture berichtigt; Issues und Nachweisgrenzen aktualisiert. |
| F10 – Playback-Shim-Vertrag | Begrenzung dokumentiert und geprüft | Setup-/Options-Vertrag und Native-Defaults geprüft, unzulässige Änderungen vor nativen Befehlen abgewiesen. Kein allgemeiner V4-Backend-Ersatz behauptet. |
| F11 – fehlende Backup-Quellen | Behoben | Verständliche „Fehlende Quelle · ehemalige ID …“-Anzeige für neue und alte v1-Backups; IDs, Format und konservatives Mapping unverändert. Backup/Restore und Neustart-Persistenz auf Android belegt; UX-Logik gezielt getestet. |
| F12 – gepinnte Payload-Patches | Abgesichert | Exakte Player-/Tooling-Hashes, negative Drift-/Tamper-Prüfungen und verbindlicher Upgrade-Ablauf; keine stillen Patch-Deaktivierungen. |

## Weiterhin offene externe Bedingungen

- **F01:** Sicherheitsausnahmen unverändert bis **21.10.2026**. Echte kompatible Abhilfe oder gesonderte ausdrückliche Entscheidung über eine neu begründete befristete Ausnahme erforderlich. Keine Verlängerung vorgenommen.
- **F06:** echte Samsung-/Huawei-Geräte, reale SAF-/OEM-/Cloud-/SD-Provider, Headset/Bluetooth und gesprochenes TalkBack fehlen. Emulatoren ersetzen diese Prüfungen nicht.
- **F07:** tatsächlicher Provider-/Gerätebenchmark fehlt; Host-Zeiten bleiben ausschließlich Host-Nachweise.
- **Main/Produktion:** keine Freigabe. `main` bleibt `b62b91b59c7400fd310a5db8fcbf9fc6444ff393`.

Der gesamte V4-Auftrag wird wegen dieser Grenzen nicht als uneingeschränkt abgeschlossen ausgegeben.

## Eindeutige neue APK-Zuordnung

Source `f2c46d3742e80655ccf06bc1900811434c4a4686`; APK-Artefakt `12044008297`; 100.832.661 Bytes; SHA256 `609d6080eb296dcf9e13791c7a67955ffbdbab6c0767ab568faa2ed001fafe50`. Archiv-SHA256 `7b3e6a3b17a12f766566192c09191405aff53cca5a456ed4ae62b692a86f08a6`. Archiv/CRC, eingebettete Source und tatsächlicher APK-Hash unabhängig geprüft. V2-Signatur im verpflichtenden CI-Gate bestanden; Zertifikat-SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Preview-Testsignatur, kein Store-Release. Zwischencheckpoint `72d193157cbb88043f5a5135ba7d2c3004e4e55b` ändert ausschließlich Dokumentation.
