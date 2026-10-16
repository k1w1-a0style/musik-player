# Zusätzlicher V4-UI-Fix: unterer Bibliothekshintergrund

Stand 16.10.2026. Ausgangspunkt `63f25f3628b3a5836cc8c26d61a6d377f10236e9`. Der bisherige APK-/36-Fälle-Nachweis bleibt historisch unverändert; dieser neu bestätigte Layoutbefund benötigt eine neue produktive APK mit eigener Abnahme.

## Bestätigung ohne neuen Gesamt-Scan

Original-Screenshot/XML aus Artefakt 12024085233, Datei `library-2.0-dark-graphite-standard`: `library-tracks-shell` endet bei y=723, der native ScrollView ebenfalls; Mini-Player y=789–906. An der Grenze springen die RGB-Werte bei x=240 von (20,22,27) bei y=722 auf (10,12,15) bei y=723. Der sichtbare dunklere Streifen stimmt exakt mit dem Ende der bemalten Listenfläche überein.

Ursache: `LibraryListShell` reserviert die Mini-Player-Höhe durch äußeres `marginBottom`. Dadurch endet der halbtransparente Panelhintergrund vor dem Abstand; der dunklere App-Gradient liegt frei. Es gibt keinen verursachenden ListFooter und kein zusätzliches FlatList-Padding: alle Listen verwenden `paddingBottom: 0`. Außerdem enthält die Overlay-Reserve bereits die Safe Area, die `Screen` selbst ebenfalls abzieht. Im Original verbleiben so 44 dp statt der vorgesehenen 20 dp zwischen Liste und Player.

## Eng begrenzte produktive Korrektur

Die Reserve liegt als `paddingBottom` innerhalb derselben eingefärbten Panel-View. Der Hintergrund läuft damit hinter dem Mini-Player durch; der tatsächliche FlatList-/Grid-Viewport bleibt oberhalb des Overlays. Der bereits von `Screen` konsumierte Safe-Area-Anteil wird genau einmal abgezogen; mindestens 20 dp Innenabstand bleiben auch ohne aktuellen Titel. Overlay-Messung, Textgrößen, Touchflächen, Footer, Daten und Scroll-Offsets bleiben erhalten. Alle sieben Library-Tabs verwenden dieselbe korrigierte Shell. Keine Änderung an Musikdateien oder Sicherheitsregeln.

## Gezielte Regression vor Build

- Neue Geometrie-/Flächenregression vor Korrektur: 5 rot / 2 grün.
- Nach Korrektur: 53 Tests in sechs Suiten (LibraryListShell, LibraryTabContent, LibraryDensity, LibraryScreenFrame, MiniPlayer und MiniPlayerViewportContext) erfolgreich. Geprüft: Safe Area 0/24/34 dp, Overlay 64/78/110 dp, genau 20 dp Abstand, reservefreie äußere Fläche, kein doppelter FlatList-Footer und beide Dichten/große Schrift.
- Typecheck, betroffene ESLint-Dateien, Source-NUL- und unverändertes Komplexitäts-Gate erfolgreich.
- 161 Python-Regressionen erfolgreich. Der neue Android-Prüfer weist die Original-XML-Geometrie ab, erkennt doppelte Insets, Überlappung und einen harten Farbwechsel am unteren Listenrand. Fabric-Geschwisterzuordnung wird durch den tatsächlichen Original-XML-Owner begrenzt.

## Eigene Geräte-Abnahme erforderlich

Die nächste einzige integrierte CI baut wegen der produktiven Layoutänderung eine neue APK. Vor dem vollständigen Funktionslauf werden wie bisher zwölf 200-%-Fälle geprüft; alle neuen Matrixfälle enthalten zusätzlich native Panel-/Listen-/Mini-Player-Bounds, 20-dp-Abstand und Pixelmessungen beidseits der alten unteren Viewportkante. Vollständige neue 36er-Matrix und kritische Dark-/Light-Sichtprüfung gelten nur für den neuen APK-Hash. Alte Fälle werden nicht als Abnahme geänderter Bytes übernommen. Sicherheitsfrist 21.10.2026, physische Geräte und realer Provider-Benchmark bleiben offen.

## Zwischenstand: neue APK und zwölf 200-%-Fälle bestanden

CI 38895123158 / Quelle `f2c46d3742e80655ccf06bc1900811434c4a4686`: Quality 4.165 Jest-/161 Python-Tests, 96 % Zeilenabdeckung, Security und Native erfolgreich. Native XML unabhängig: 178 Tests, 0 Fehler/Skips. Neue APK: 100.832.661 Bytes, SHA256 `609d6080eb296dcf9e13791c7a67955ffbdbab6c0767ab568faa2ed001fafe50`, Artefakt 12044008297; Archiv-Digest/CRC, eingebettete Source und APK-SHA unabhängig geprüft; verpflichtendes V2-Signatur-Gate bestanden, bekanntes Preview-Zertifikat. Android-Job 116959315614 hat die zwölf gezielten 200-%-Fälle einschließlich Hintergrund-/20-dp-Assertions bestanden. Der vollständige neue Funktionslauf und die frische 36er-Matrix laufen; finale Sichtkontrolle und APK-Abnahme bleiben offen.
