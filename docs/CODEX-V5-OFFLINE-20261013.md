# Full Scan und Ideen – V5-Checkpoint bei getrennter Arbeitsumgebung

Zeit: 2026-10-13T15:25:55.666Z. Kein Projektneustart. Vollständiger ursprünglicher V5-Auftrag bleibt verbindlich.

**Nicht abgeschlossen; APK nicht freigegeben.** Die lokale Toolausführung meldet ausdrücklich:
`409 Conflict, environment_offline: Environment is not connected`.
Zwei lokale Anfragen lieferten zunächst keine Antwort; ein Wartevorgang wurde beendet. GitHub ist erreichbar. Kein weiterer lokaler Schreib-/Testversuch ohne Wiederverbindung. Dieser Infrastrukturfehler ist kein Nachweis, dass Plugins oder der Android-Emulator ihn verursacht haben.

## Sicherer Stand

- Letzter verifizierter codex-HEAD: `77ff72d938ae1fec6dd96ff25d80071bf3e6e3a6`.
- main unverändert: `b62b91b59c7400fd310a5db8fcbf9fc6444ff393`.
- Bestehende Ausgangssicherung: backup/codex-before-v5-resume-20261013-332249f.
- Dieser Diagnose-/WIP-Checkpoint liegt auf einer eigenen Backup-Ref. Nicht pauschal in codex mergen; die Entwürfe selektiv übernehmen und testen.
- Originalmusik nicht verändert. Die Übergabe enthält 21 Referenzdatensätze, keine Original-Audiodateien. Physische Gerätefixtures sind ausschließlich synthetisch.

## Tatsächlich erledigt

Die fünf ursprünglichen CI-Fehler wurden unter f861e88 reproduziert und behoben. Der Speicherfehler wurde kritisch untersucht: neben unvollständig abgewickelter Testwartung waren zwei reale Datenverlustfälle vorhanden. Enumeration erfolgt jetzt vor Löschung; Legacy, Manifest und Chunks werden gemeinsam in der nativen SQLite-Transaktion gelöscht. Epochwechsel, verzögerte Deletes und Folgewrites regressionsgeprüft. Keine Fehlerunterdrückung oder Test-/Securityabschwächung.

Produktivfix `2689eb20556e544ee3b838ad24eb1dc11bd5780a`: Mini-Player-Visibility-Cleanup löschte eine bereits eingetroffene native Höhenmessung. Regression zunächst rot; Hide und Unmount nun getrennt. Gezielte 4 Suiten / 33 Tests, Typecheck und Lint erfolgreich. Geräte-XML bestätigt Listenende y=742 statt y=894.

Harnesscommits 20e81a3 / c0f196d / ac59c7f / 77ff72d korrigieren Import-Scroll-Voraussetzungen, den exakten nativen Resume-Button, zeitbezogenen Resume-Nachweis und den öffentlichen Playlist-Done-Weg. Native Dauer, exakter Titel, PLAYING und Positionsfortschritt bleiben Pflicht.

SAF-Blocker **nachweislich geschlossen**: Retest 38410323215 / Job 115340616211 / Artefakt 11822726097 bestand MP3, M4A, FLAC und SAF nativ; SAF 19→32 Sekunden, state=3. Danach Stop an Android-Großschreibung FORTSETZEN; der Dialog nach echtem Kill/Restart zeigte korrekt gespeicherte 4:19. Diese Buttonabfrage ist korrigiert, vollständiger Resume-Nachweis noch offen.

## Verifizierte CI und genaue APK

Letzte CI 38417716310 auf 77ff72d vollständig erfolgreich: 426 Jest-Suiten / 4.125 Tests, 64 Python-Tests, Typecheck/Lint/Konfiguration/Manifest/Bundlegates, Security und 178 native Tests. Die bedingt angeforderte Preview-UI lief dort nicht; ihre separate Abnahme ist weiterhin offen. Grüne Host-/Nativtests nicht mit APK-Abnahme verwechseln.

APK-Quellcommit: 2689eb20556e544ee3b838ad24eb1dc11bd5780a.
Quell-CI: 38404541051; APK-Artefakt: 11818714275.
Größe: 100.823.865 Bytes.
SHA-256: `2544b53dd51e73f93f543d69f29be7721264330cf5907052a18b37dd5765be6f`.
Hash und ZIP-Integrität lokal unabhängig bestätigt; v2-Signatur, Manifest, Paket und ABIs geprüft.
Paket com.k1w1a0style.musikplayer, Version 1.0.0 / Code 1, minSDK24, targetSDK36, vier ABIs.
Preview-Zertifikat SHA-256: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c.
Installierbare Testsignatur, keine private Store-Veröffentlichung. **Keine finale Freigabe.**

Security: 0 kritisch, 23 hoch, 5 mittel unter unveränderten befristeten F25-Ausnahmen, Issue #396, Ablauf 21.10.2026. Keine Fristverlängerung. Nicht als Roh-Audit null ausgeben.

## Aktuelle Ursachen und offene Arbeit

1. **Echter Scan-/Navigationsfehler bestätigt.** Probe 38417716217 / Job 115367017474 / Artefakt 11825580956: Eingabe verschwindet, UI ist wieder auf Titel. Code hooks/useLibraryImportStateUpdate.ts setzt bei jeder Veröffentlichung setActiveTab('tracks'). Das laufende Importende überschreibt die vom Nutzer gewählte Playlistansicht. Erste Probe 38415757433 / Job 115359617866 / Artefakt 11824171945 endete deswegen nach pauschalem BACK auf dem Launcher. Public-Done-Weg ist zusätzlich abgesichert; eigentliche Tabursache noch nicht produktiv behoben.
2. **Queue-/Notification-Race noch nicht abschließend auf Gerät bewiesen.** Zwei M4A-Fehlversuche auf identischer APK zeigen NONE nach fünf bzw. drei externen SystemUI-STOPs (Jobs 115330022195 und 115349961276; Artefakte 11820170287 und 11822903624). Andere Läufe mit allen vier Formaten bestanden und hatten keine STOPs. Keine dritte identische Wiederholung. Neue gezielte Probe soll eine öffentliche Zwei-Titel-Playlist auf die Vier-Titel-Bibliothek wechseln und native Queuegrößen/Sessions/Notifications erfassen; beide Proben wurden vorher durch den echten Tabfehler blockiert. Hypothese: stop/clear/add beim Rebuild entfernt die alte Notification und erzeugt verspätete STOPs.
3. **Lokale reale Backend-Regression vorhanden.** Neue queueReplacement.integration.test.ts lädt tatsächliche Domain und V5-JS, simuliert nur die Android-TurboModule-Grenze. Rot: nichtleerer Ersatz publiziert einmal leer (erwartet 0, erhalten 1). Ein gültiger neuerer STOP gewinnt dann wie vorgesehen. Entwurf vollständig als .txt gesichert. Typecheck für den Entwurf noch nicht gelaufen; externalStop sollte explizit als () => void typisiert werden. Nicht blind in codex übernehmen.
4. Neue Scan-Tab-Regression wurde angefordert, vor Infrastrukturabbruch aber nicht bestätigt/ausgeführt. Entwurf gesichert; vor Wiederanwendung lokale Datei prüfen.
5. Noch offene Geräteabnahme: vollständiges Resume On/Off, Hintergrund/Queue-Gesten, Backup-Export/Inspektion/Restore mit IDs/Reihenfolge/Favoriten und Kaltstart, 36 Akzentoptionen/Persistenz/beide Player, synthetischer SAF-Cleaner-Dry-Run/Anzeige/Datei mit unabhängigen Audio/APIC/TPUB/WXXX/XKIW-Bytebelegen, 320-dp-Font-/Theme-/Dichtematrix und finale APK.

## Fortsetzung ohne Wiederholungen

- Zuerst wieder verbundene Arbeitsumgebung prüfen, codex-HEAD und vorhandene Stashes/WIP erhalten. Kein reset/clean, keine Originaldateien ändern, main nicht anfassen.
- GitHub-Checkpoint und beide Entwürfe lesen. Die bereits erledigten fünf Jest-Fixes, CSV-Analyse und SAF-Höhen-/Scrollkorrektur nicht erneut bauen.
- Scan-Navigationsregression gezielt rot→grün; bestehende Cancel/Stale/Delta/Persistenztests erhalten.
- Queueursache nach behobenem Tabfehler gezielt messen. Bei belegtem Bedarf atomare nichtleere Queue-Replacement-API über V5 setMediaItems mit echten Native-ACKs einsetzen; explizites Stop/Clear und neuere echte Remote-STOPs weiterhin respektieren. Keine blanket STOP-Unterdrückung.
- Gezielte Regressionen vor vollständiger CI/neuem Build. Produktivänderung benötigt neue APK; nach erneutem Build Retest-Provenienz auf deren exakten Commit/Hash/Gates pinnen.
- Diagnosemodus schreibt diagnostic-only / releaseAccepted=false und ersetzt niemals die gesamte Abnahme.
- Vollständige Abnahme durchziehen; erst danach exakt geprüfte APK mit Bericht bereitstellen.

## Infrastruktur und Effizienz

Android lief in GitHub Actions API35 x86_64, 480×960 / density240 =320dp. Native Build 19m15s; diese Wartezeit entstand vor Emulatorstart. Limrun-MCP verfügbar und ohne alte Instanzen, CLI hier nicht authentifiziert. QA Wolf für verbundenes Konto nicht freigeschaltet. Keine neue Anmeldung verlangt, keine fremden Instanzen verändert. Zwei Push-Workflowstarts derselben SHA wurden beobachtet, einer abgebrochen; Ursache noch offen. Vor künftigem Refupdate nach Commit nochmals Remote-HEAD prüfen, damit eine bereits veröffentlichte eigene SHA nicht nochmals veröffentlicht wird.

Keine A50-Hardware oder gesprochene TalkBack-Prüfung verfügbar; diese Grenzen ausdrücklich benennen. Physische Renames und FLAC-Tagwrites bleiben gemäß V5 ohne sicheren nativen Formatvertrag Vorschau/Export.

[Letzte grüne CI](https://github.com/k1w1-a0style/musik-player/actions/runs/38417716310)
[SAF-Nachweis](https://github.com/k1w1-a0style/musik-player/actions/runs/38410323215)
[Letzte gezielte Probe](https://github.com/k1w1-a0style/musik-player/actions/runs/38417716217)
[F25](https://github.com/k1w1-a0style/musik-player/issues/396)
