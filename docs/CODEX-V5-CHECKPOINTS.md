# V5 - kompakter Fortsetzungsstand

Stand: 12.10.2026. Feature-Quellcommit e8c30d34ac86a1ef40801ce46532638fbe58fc1f auf codex; main unverändert. Dieser Folgecommit ergänzt die SDK-Patches und den V5-Gerätetreiber. Aktuellen HEAD mit git rev-parse HEAD ablesen.

## Implementiert und gezielt verifiziert

- Getrennte Tag-Bereinigung mit roher ID3/MP4-Vorschau, konservativen Regeln, Feldfreigabe, bestätigter Bibliotheksanzeige, reserviertem SAF-CAS, Queueprüfung, Transaktionsschutz, Abbruch zwischen Dateien und O(1)-Journaleinträgen. Kommentare, Cover und unbekannte Frames bleiben geschützt; Rename/Website-Entfernung nur Vorschau/Export.
- Mehrfachauswahl und Album-/Ordner-/Playlist-Einstiege; echte Settings/Navigation/Provider-/Backup-Verträge integriert.
- Scan-Speicherabschluss unabhängig von optionalem Cleanup, echte IO-/Epochbesitzer; kompakte Statusanzeigen mit konkretem Fehler und Quick-/Full-Retry.
- Budgetierte Quickscan-Yields. 8 Workloads x20 Hostmessungen; bei 5k dated p50 3069.583 auf601.356ms, identische IO-Zähler. Keine Gerätemessung daraus ableiten.
- FLAC/Vorbis-Tags read-only; vorher echte Fixturetags übersehen, jetzt bounded/ranged geprüft.
- 12 unabhängige App-/Player-/Waveformfarben, persistente Preferences, physisch gemessener Listenviewport, keine leere Wechselnotice, 250ms/sofort/OS-ReduceMotion und revisionsgeschützter Palettecache.
- F25: vollständige Forge-/braces-Payloadhärtung und streng gebundener Auditgraph. Roh-Audit0critical/23high/5moderate; Issue396 und Frist21.10.2026 weiterhin offen.

Rootintegration: Typecheck und lint:ci0, Complexity4206 unverändertengegrenzt, gezielte Rootpakete156/34/45/22/54Tests grün (Überlappungen nicht als zusätzliche Tests zählen). Backup12-Accent-Roundtrip und SettingsCleanerroute gezielt geprüft.

## Aktueller Blocker / Folgedelta

CI38288668575 für e8c30d3: Securityaudit erfolgreich, Quality stoppt VOR Jest am Online-Expo-Check. Verlangt expo57.0.28, expo-dev-client57.0.20, jest-expo57.0.6. Genau diese3 direkten Patchstände und ihre14 Expo-Lockfileeinträge wurden aktualisiert. React19.2.3/RN0.86.3/RNTP5.12.1, NewArchitecture und RNTP-Nativpatch bleiben unverändert. Offline-Kompatibilitätscheck und frischeTypeprüfung0; definitiveOnlineprüfung erfolgt in folgenderCI. Auditgraph nur2 Versionsbindungen aktualisiert, alle übrigen Kanten/Nodes/Severities identisch; Payloadintegrität und Raw-Audit neu verifiziert. Kein Auditdeadline- oder Gate-Bypass.

V5-Treiber a8a145f45d088f2774b1a2d503e19b716953698d integriert:47PythonTests, 36Radios/ColdStart/beidePlayerlayouts, Auswahl/Anzeige-Cleaner/SAF-Syntheticdatei mit Audio/APIC/TPUB/WXXX/UnknownFrame-Erhalt. Androidausführung noch nicht bestätigt.

Original-Tracks.zip unabhängig read-only vollständig CRC-geprüft:21MP3, ID3v2.3, 13WXXX, 21APIC. Keine Originaldatei verändert oder Musikbyte im Repo veröffentlicht.

## Nächster Schritt

Neue vollständige CI für diesen abgeschlossenen SDK-/Harness-Folgecommit; fehlgeschlagene Gates gezielt beheben. Dann dieselbe exakt zugeordnete neueAPK öffentlich aufAndroid prüfen, Hash/Signatur/Quelle festhalten. Full-Scan- und Ideen-Dokumente mit endgültigen Resultaten aktualisieren und speichern. Keine ältereP1-APK als finaleV5 liefern.

## Wiederherstellbare Paketobjekte

Auswahl d2a3a74; Cleaner b765c5f; UI449955e; Scan91db509; Performance0eab324; Retryf04e827; F2508c3e074; FLACfb1550e; Harnessa8a145f. Diese IDs sind Quellencheckpoint-Referenzen; die Featureintegration ist e8c30d3. Keine abgeschlossenen V3/V4-Analysen wiederholen.

## Fortsetzung 13.10.2026 – fünf CI-Blocker behoben

Ausgangs-HEAD 332249f77dbc7768434019ccc27bc7d7f1920104; main geprüft unverändert auf b62b91b59c7400fd310a5db8fcbf9fc6444ff393. Saubere neue Arbeitskopie, keine erreichbaren anderen Git-Worktrees und keine aktiven GitHub-Runs. Alter Chat-/Workspacezustand nicht zugänglich. Ausgangsstand zusätzlich unter backup/codex-before-v5-resume-20261013-332249f gesichert.

- Alle fünf CI-Fehler lokal reproduziert: 5 fehlgeschlagene Tests / 235 Tests.
- Scan-Tests öffnen nun die standardmäßig eingeklappten Details; Cancel, bestätigte Titel und verspätete Veröffentlichungen bleiben geprüft.
- Ungültige Akzentwerte werden wirklich unbekannt gewählt; Lila-Speicherung/Provider-Neustart zusätzlich geprüft. Nur die zentrale Akzent-/Kontrastquelle in der Farbarchitektur freigegeben; übriges Farbverbot unverändert.
- storage.test.ts wartete nicht auf die vom vorherigen Test angeforderte optionale Wartung. Diese verbrauchte den einmaligen removeItem-Fehler. Wartung wird vor Testreset vollständig abgewickelt und der Speicherbesitz zurückgesetzt; keine produktive Fehlerunterdrückung ergänzt.
- Zusätzlich zwei reale Datenverlustregressionen zunächst rot nachgewiesen: fehlgeschlagene Enumeration verlor eine Legacy-Bibliothek; fehlgeschlagenes Chunk-Delete verlor die Rückfallkopie. Fix: Legacykey vor Wartung schützen, vor Löschung enumerieren, Chunkmanifest/Chunks/Legacy gemeinsam per Android-SQLite-multiRemove-Transaktion entfernen. Keine separate vorzeitige Rollbacklöschung. Fehler propagieren weiter. Epochwechsel und verzögerte native Löschung mit anschließendem Write extra geprüft.
- Gezielte ursprüngliche fünf + drei Speicherdateien: 8 Suiten / 278 Tests bestanden. Anschließende V5-Nachbarn einschließlich finaler vier neuer Löschtests: 11 Suiten / 84 Tests bestanden (Überlappungen nicht addieren).
- Typecheck, lint:ci und unveränderte Complexity-Grenzen (4206 Produktionsfunktionen) bestanden. Python-Harness: 47 Tests bestanden; dies ersetzt keine APK-Abnahme.

Nächster Schritt: vollständige CI mit Preview-APK auf diesem Paketcommit, anschließend öffentliche Android-UI auf exakt dieser geprüften APK. Security F25, Frist21.10.2026 und Hardwaregrenzen bleiben offen ausgewiesen; Originalmusik wurde nicht verändert.


## Öffentliche APK-Abnahme und gezielter Harness-Fix

Quellcommitf861e88e889203237c065ef1ab49e08213584a5b: CI38337505996 Quality426Suiten/4124Tests, Security und Native168SystemAudio+10RNTP erfolgreich. APK100823781Bytes, SHA25609e99ae725d53b1a82a0c1e8b65885bf3ee6a1c3e410782fa4b381c47543a45b; Manifest/ABIs/v2-Signatur geprüft. APKArtifact11786046328. Keine finale Freigabe: UIJob115104595609 scheitert nach erfolgreicher MP3/M4A/FLAC-Abnahme beim SAF-Dauervergleich80s.

UIArtifact11786586774 zeigt SAF korrekt als1:20 importiert, Player aber nochV3FLAC2:30. Die Accessibilityhierarchie liefert Songbounds[28,746][290,829] teilweise hinter MiniPlayer[18,808][462,906]. Bisheriger Treiber behandelte jede bildschirmweite Node als touchbar, ohne Parentclip/Overlayprüfung, und wartete nur auf einen schon vorhandenen MiniPlayer statt auf den ausgewählten nativen Titel.

Drei neue Harness-Negativtests zuerst rot; korrigierte Parentclip-/MiniPlayergrenze und richtige Scrollrichtung plus app-eigener nativerTitle/PLAYING-ACK bestehen50PythonTests. Am tatsächlichen Fehler-XML unabhängig reproduziert: alte Targetprüfung akzeptiert den verdeckten Knoten, neue lehnt ihn ab und scrollt innerhalb[12,279][468,808]. Dauertoleranz bleibtmax1s; falscher Titel bleibt Fehler. Retestworkflow pinnt nun exaktf861-APK/Hash/CI38337505996; alle3ursprünglichen Quellgates und Produktivquellenidentität werden unverändert streng verlangt. APK und Appcode unverändert; neue komplette öffentliche Abnahme noch erforderlich.

Retest38339853476 endete vorSAF-Auswahl am echten DocumentsUI-Dialog: nativeGridView im ScrollView, beide melden dieselbenBounds[0,36][480,960]. Genau diese Verschachtelung war vorher nicht geprüft. Neuer zunächst roter Fall belegt die Ursache; der Treiber wählt jetzt ausschließlich den innersten zuständigen Scrollbereich. Echte mehrdeutige Geschwister bleiben gesperrt; zusätzlicher Negativtest.52PythonTests grün und realesFehler-XML separat geprüft. Keine Änderung an App, APK, Zeittoleranz oder Schreibsicherheit. Folgeretest derselbenAPK erforderlich.

Retest38340591074 zeigte vorÖffnen desM4A-Players bereits den korrekten nativen Titel, aberStateNONE(0). Die neu hinzugefügte frühePLAYING-Bedingung war dort stärker/früher als der bisherige Vertrag. Auswahl-ACK bestätigt jetzt exakt app-eigenen Metadatentitel, ohne Decoderlauf zu behaupten. Die anschließende unveränderteDauer-/PLAYING-/Positionsfortschrittsprüfung bleibt verpflichtend und erkennt permanentenNONE/PAUSED oderStillstand. Titelpräfixe/fremdeSessions werden zusätzlich abgelehnt;53PythonTests grün. Kein Produktivcode/Audio/APK verändert.

Retest38341342843 bestätigt erneut alle3Formate, stoppt danach vorSAF am Systemgrant. RealesLatest-XML enthält nurSystemUI; finalesXML zeigt exakt denAllow-Dialog fürV3OnlySAF. Einmalige.4s-Abfrage durch25s-boundedPolling des exaktenFoldertitels/aktiviertenALLOWbutton1 ersetzt; keine Bestätigung fremderDialoge. Aktionsabfragen nutzen kompakteAccessibilityhierarchie mit vollständigemFallback für prunedContainer; MiniPlayer-Button schützt auch ohneLayoutmarker denViewport. Screenshots behalten vollständigesXML, Snapshotzeiten werden separat protokolliert.57PythonTests grün; echterTransient/Dialog unabhängig geprüft. Kein App-/APKdelta.

## SAF-Viewport-Ursache nach Retest 38342610200

Stand 16055b385e80e8dda8b77b5ee2e38e1dec96b8ab erneut abgeglichen: saubere Arbeitskopie, vorhandene Sicherungsstashes erhalten, keine lokalen Jest/Gradle/adb-Prozesse und keine laufenden GitHub-Runs. CI 38342610225 vollständig erfolgreich. Die normale Prozessabfrage hatte einen Systembibliotheksfehler; /proc-Ersatzprüfung funktionierte. Kein Beleg für einen Plugin-bedingten Stillstand. Android läuft in GitHub Actions (API 35), nicht in einem lokalen Emulatorplugin.

Retest 38342610200 bestätigt MP3/M4A/FLAC nativ und den erfolgreichen SAF-Import, scheitert aber nach begrenztem Scrollen an einer teilweise verdeckten Karte. Reales XML: SAF [28,746][290,829], Mini-Player [18,808][462,906], Listenviewport bis y=894. Eine produktive Lifecycle-Race wurde mit einem echten MiniPlayer/ViewportProvider-Integrationstest zunächst rot nachgewiesen: onLayout im Layout-Effekt vor den passiven Visibility-Effekten reserviert 78 dp; deren alte Cleanup setzt anschließend den Abstand von erwarteten 134 dp auf 20 dp zurück.

Fix trennt Ausblenden von Unmount-Cleanup. Beim erstmaligen Einblenden wird die native Messung nicht mehr gelöscht. Regression prüft erste Auswahl, Titelwechsel, Ausblenden, erneutes Einblenden und Unmount. Assertions, Scrollschutz, Sicherheitsregeln und Auditausnahmen unverändert. Wegen produktiver Änderung neue Preview-APK und komplette öffentliche V5-Abnahme erforderlich; alte APK ist nicht freigegeben.

## Neue APK und korrigierter SAF-Importnachweis

Produktivcommit 2689eb20556e544ee3b838ad24eb1dc11bd5780a: CI 38404541051 Quality 426 Suiten / 4.125 Tests, 57 Python-Tests, Typecheck/Lint/Expo/Manifest/Hermes/Komplexität vollständig erfolgreich. Security erfolgreich: 0 kritisch, 23 hoch, 5 mittel unter unveränderten F25-Ausnahmen. Native 168 SystemAudio + 10 RNTP erfolgreich, Gradle 19m15s. APK-Artefakt 11818714275, 100.823.865 Bytes, SHA256 2544b53dd51e73f93f543d69f29be7721264330cf5907052a18b37dd5765be6f, v2-Signatur und festes Preview-Zertifikat verifiziert; lokal Hash und ZIP-Integrität unabhängig bestätigt. Keine Gerätefreigabe.

Geräteversuch 1 (Job 115330022195, Artefakt 11820170287) bestand MP3, scheiterte bei M4A-NONE. Logs zeigen fünf externe SystemUI-STOPs; Ursache nicht abschließend bewiesen. Ein gezielter Rerun nur fehlgeschlagener Jobs ohne Build bestätigte danach MP3/M4A/FLAC (Job 115334573087, Artefakt 11821001386), keine externen STOPs. Der Viewportfix ist im XML bestätigt: Listenende y=742 statt y=894. SAF ist importiert, aber korrekt unterhalb des sichtbaren Viewports; die vorangestellte find-Abfrage scrollte nicht und scheiterte vor der eigentlichen Scroll-/Wiedergabeprüfung.

Neue Flow-Regression zuerst rot, nach Entfernen ausschließlich dieser redundanten Abfrage grün: Der reale folgende play_title-Vertrag verlangt unverändert vollständige Touchbarkeit nach Scrollen und den exakt ausgewählten nativen Titel; Dauer/PLAYING/Positionsfortschritt bleiben Pflicht. 58 Python-Tests erfolgreich. Retestworkflow exakt auf neue APK, Quellcommit und drei erfolgreiche Quellgates gepinnt. Kein neues Produktivdelta, daher kein neuer APK-Build angefordert.

Kein laufender lokaler Emulator und keine Limrun-Instanz beim Zustandsabgleich. Plugins als Ursache nicht belegt. Die beobachtete lange Buildphase fand vor Emulatorstart statt. Originalmusik und main unverändert. Bei erneut gleichem Fehler nach zwei gezielten Versuchen Diagnosemethode wechseln.

## SAF abgenommen; Resume-/Cleaner-Treiber gezielt korrigiert

Retest 38410323215, Job 115340616211, Artefakt 11822726097: MP3 33→53 s, M4A 30→48 s, FLAC 24→37 s und SAF 19→32 s mit exakter app-eigener nativer PLAYING-Session bestanden. SAF-Import, Scrollen, Auswahl und Wiedergabe damit nachgewiesen. Kein neuer Produktivfix erforderlich.

Nächster Stop bei Resume: Dialog nach echtem Kill/Restart zeigt gespeicherte 4:19 und aktiviertem android:id/button1 mit Text FORTSETZEN. Treiber suchte JS-Schreibweise Fortsetzen. Flow-Regression zuerst rot; nun exakter app-eigener Dialogtitel + aktivierter positiver Button und semantisch exakter Text (Android-Großschreibung zulässig). Andere Dialoge, fremde Apps, Von-vorn/Cancel-Buttons und deaktivierte Aktionen werden abgelehnt.

Positionsnachweis berücksichtigt nun tatsächlich gemessene Wiedergabezeit während UI-Abfragen: gespeicherter Start + verstrichene Zeit mit derselben 3-s-Clock-/Sekundenauflösungsgrenze wie die Native-Progress-Prüfung. Die realen Formatproben benötigen durch UI-Abfragen 13–20 s; eine starre absolute 12-s-Differenz würde korrekte Wiedergabe ablehnen und zugleich Stillstand am gespeicherten Punkt akzeptieren. Zusätzliche Pflicht: nativer exakter Titel und PLAYING vor und nach der UI-Positionsmessung. Negativtests lehnen Stillstand, falschen Start, Reset und Sprung ab; keine pauschale Toleranzerweiterung.

Beim Cleaner-Import denselben bereits nachgewiesenen redundanten Sichtbarkeitswait entfernt. Die nachfolgende reale Longpress-Auswahl scrollt und prüft weiterhin die vollständig touchbare importierte Karte; Dry-Run-Bytevergleich und native Schreib-/Audio-/Framebelege unverändert. Zweite Flow-Regression dafür zuerst rot. Insgesamt 62 Python-Tests grün. APK weiterhin exakt 2689eb2 / SHA256 2544b53dd51e73f93f543d69f29be7721264330cf5907052a18b37dd5765be6f; finale V5-Abnahme noch offen.

## Zweiter SystemUI-STOP-Fall: Diagnosemethode gewechselt

Retest 38413004964 / Job 115349961276 / Artefakt 11822903624 scheitert erneut vor Resume bei M4A-NONE; drei externe SystemUI-STOP-Kommandos wie beim ersten gleichartigen Fall. Kein dritter identischer vollständiger Lauf. Limrun-MCP ist verfügbar, CLI aber nicht authentifiziert; QA-Wolf-Zugang für verbundenes Konto nicht freigeschaltet. Keine neuen Logins angefordert und keine fremden Instanzen verändert.

Neue Diagnoseprobe auf unveränderter, exakt gepinnter 2689eb2-APK: über öffentliche UI zwei Titel in eigener synthetischer Playlist abspielen/pausieren, dann M4A aus der Vier-Titel-Bibliothek wählen. Native Queuegröße 2 vor und 4 nach Replacement wird ausdrücklich validiert; Sessions, Notificationzustand, Screenshots und Logs pro Phase gesichert. Zwei Probewechsel maximal. Hypothese: stop/clear/add beim notwendigen Queue-Rebuild entzieht die alte Notification und provoziert verspätete externe SystemUI-STOPs. Noch kein behaupteter Produktivfix. Diagnosemodus schreibt ausdrücklich diagnostic-only / releaseAccepted=false und ersetzt nicht die komplette V5-Abnahme. 63 Python-Tests erfolgreich; APKbytes, Quellgates, Sicherheitsregeln und main unverändert.

Erster Probelauf 38415757433 / Job 115359617866 / Artefakt 11824171945 endete vor dem Queuewechsel: nach Eingabe QueueProbe schloss BACK die Activity zum Launcher. Logs zeigen eine zuvor bereits geschlossene Tastatur; kein Queuebefund aus diesem Versuch. PlaylistCreateForm bietet ausdrücklich onSubmitEditing / returnKeyType=done. Gemeinsamer Public-UI-Helper prüft nun den exakten eingegebenen Namen, fokussiert dasselbe sichtbare Eingabefeld und verwendet ENTER/Fertig; die tatsächliche erzeugte Playlist muss erscheinen. Kein BACK zum vermeintlichen Tastaturschließen, keine private Eventinjektion. Eigene Flow-Regression schützt gegen verlorene Zeichen und ungewollte Navigation; 64 Python-Tests grün. Vorbereitete Backend-Regressionsarbeit bleibt lokal gesichert und wird nicht als produktiv fertig veröffentlicht.

## Fortsetzung: echter Tabwechsel während Playlist-Erstellung

Arbeitsumgebung wieder erreichbar; codex weiterhin 77ff72d, keine laufenden lokalen Jest/Gradle/Emulatorprozesse. Die unveröffentlichte Queue-Regression und alle Sicherungsstashes sind erhalten; zusätzlich GitHub-Backup d5c8f5f3ffbb75a6cd2118700c646a63ef6836ad. QA Wolf wird auf ausdrücklichen Wunsch nicht benutzt.

Probe 38417716217 / Artefakt 11825580956 zeigt nach der Texteingabe erneut Tracks statt Playlists. Tatsächlicher Appcode publizierte jeden Importcheckpoint mit setActiveTab('tracks'); spätere Pakete entfernten das gerade benutzte Formular. Hook-Regression zuerst rot mit erwartetem playlists / tatsächlichem tracks. Jede Importgeneration öffnet Tracks jetzt nur bei der ersten bestätigten Veröffentlichung. Weitere Checkpoints und Abschluss respektieren die Benutzeransicht; neue Generation öffnet Tracks weiterhin. Abbruch-/Stale-/Persistenzschutz unverändert. Zwei gezielte Suiten / 35 Tests erfolgreich. Produktive Änderung verlangt eine neue APK; die alte APK bleibt nicht freigegeben.
