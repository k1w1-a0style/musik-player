# Audio-Leseberechtigung – Reparatur und Abnahme vom 22.10.2026

Fortsetzung 23.10.: Der Fix wurde inzwischen in der exakten eae77b31-APK auf Android 15 mit Ablehnung/erneuter Erteilung, Entzug/Settings-Rückkehr, Schnell-/Vollscan, SAF und Datenerhalt geprüft. [Aktueller Gerätebericht](android-eae77b31-2026-10-23.md). Die Angaben darunter sind der historische Stand vom 22.10.; keine Gesamtfreigabe.

Status: Codekorrektur, vollständige Qualitäts-CI und native JUnit-/APK-Prüfung erfolgreich. Installation und Android-UI-Abnahme ausstehend; keine Release-Freigabe. Produktquelle `63d5a61bad64af8af9be604e25dffbffb1298898`, [CI39828111896](https://github.com/k1w1-a0style/musik-player/actions/runs/39828111896). Arbeitsbranch ausschließlich `codex`; `main` unverändert. Übernahmestand `0ee18941696dd660e3d5945b866d74ac467a6f94`, keine ungesicherten Arbeiten oder aktive aktuelle CI beim Einstieg.

## Reihenfolge und Abgleich

1. Nutzerfehler im echten Import-Hook mit dem originalen `Missing MEDIA_LIBRARY permissions` nachbilden; Schnell-/Vollscan und Erhalt gespeicherter Titel prüfen.
2. Installiertes Expo-Modul, tatsächliche APK-Metadaten, Request/Get/Recheck und API-Gruppen abgleichen. Read-only-Grenze minimal korrigieren.
3. Scan-/SAF-/Speicher-/Abbruchpfade und konkrete Fehleraktionen prüfen. Bestehende V5-Funktionen erhalten.
4. Einzeltests, TypeScript und Lint vor integrierter CI; native API-Prüfungen und exakte neue APK nachweisen.
5. Security, Cover-Crash, Emulator-/UI- und physische Abnahme getrennt bewerten. Fehlende Belege bleiben offen.

## Bestätigter Kompatibilitätsfehler

Installiert ist `expo-media-library@57.0.5` (Expo57.0.31). Der Registry-Abgleich bestätigt57.0.5 als neueste stabile57er-Version;58.0.11 gehört zur nächsten SDK-Linie und wird nicht blind eingespielt. Die Legacy-API wird ausdrücklich aus `expo-media-library/legacy` verwendet. `getAssetsAsync` ruft `requireSystemPermissions(false)` auf. Die ursprüngliche native `hasReadPermissions()` fordert unter API33 gemeinsam READ_EXTERNAL_STORAGE und WRITE_EXTERNAL_STORAGE. Der Request fordert die Schreibberechtigung nur an, wenn sie im Manifest existiert. Unsere Policy entfernt sie bewusst. Dadurch kann ein tatsächlich gewährtes Leserecht beim Request als granted gelten und unmittelbar danach an der nativen Leseprüfung scheitern.

Die bisherige Anfrage ohne Audio-Parameter sowie eine fehlende unabhängige Recheck-Stufe sind zusätzlich korrigiert. Ab Android14 verhindert die explizite Audio-Anfrage außerdem, dass ein nur visueller Teilzugriff als ausreichender Musikzugriff behandelt wird.

Die tatsächliche Android-Version, installierte APK-SHA und PackageManager-/AppOps-Zustände des Nutzergeräts sind in dieser Umgebung nicht zugänglich: kein ADB-Gerät/USB-Bus. Sie werden nicht aus Browserkennung oder Screenshotdatum geraten. Die bisher verfügbare APK0012899 enthält laut realer aapt-Prüfung READ_MEDIA_AUDIO und READ_EXTERNAL_STORAGE, keine breite Schreibberechtigung; sie ist wegen dieses neu bestätigten Importfehlers ebenfalls keine finale Freigabe. Der konkrete Gerätepfad ist erst durch eine erneute Testinstallation bestätigt.

| Android | Nötiger globaler Lesezugriff | Korrektur / Grenze |
|---|---|---|
| API24–28 | READ_EXTERNAL_STORAGE | Kein WRITE für Lesezugriff; cap32. |
| API29 | READ_EXTERNAL_STORAGE für fremde Musik | Scoped MediaStore bleibt aktiv; kein Legacy-All-Dateien-Modus. |
| API30–32 | READ_EXTERNAL_STORAGE für fremde Musik | Kein wirkungsloser WRITE-Zwang bei modernem targetSdk. |
| API33–36 | READ_MEDIA_AUDIO | Request/Get ausdrücklich false, [audio]; kein Foto-/Video-/Selected-Visual-Zugriff. |
| Gewählter SAF-Ordner | Persistente URI-Freigabe | Unabhängiger bestehender Pfad; keine globale Musikberechtigung vorausgesetzt. |

## Enger Fix und verbundene Bereiche

- Versions- und vollständige Quellhash-Bindung der Expo-Korrektur im postinstall. Ein einziges natives Read-Guard-Segment verwendet den getesteten AudioReadPermissionPolicy-Helper. Unbekannte Version/Quelländerung/Helper-Manipulation bricht vor einer Änderung ab. Wiederholte Installation prüft beide Payloads. Schreibprüfungen und Query-Code bleiben exakt upstream; keine WRITE-/MANAGE-Berechtigung ergänzt.
- Native Audio-Leseprüfung: vor33 Legacy-Read, ab33 Audio-Read. Fehlender PermissionManager verweigert Zugriff. Keine gecachte Grant-Annahme.
- Import: aktuelle Audio-Berechtigung lesen, nur bei erneut anfragbarem Status einmal anfragen und anschließend tatsächlichen Grant erneut lesen. Kein Scan nach Ablehnung. Jede neue Scanaktion prüft frisch; Rückkehr aus Einstellungen startet keinen automatischen Import.
- Timeout-/Abbruchsignal gilt auch während der Rechteprüfung; verspätete native Resultate dürfen weder einen neuen Prompt noch einen Scan starten.
- Rechtefehler wird als gescheiterter Scan mit deutscher Erklärung gespeichert. Einstellungen und SAF-Ordnerauswahl sind direkt erreichbar. Fehler beim Öffnen der Einstellungen wird verständlich behandelt. Keine rohe Expo-Exception im sichtbaren Fehler.
- Ablehnung und Fehler löschen keine Songs/Metadaten, führen keine Ordnerpersistenz aus und lösen keine automatische Fallback-Massenaktion aus. Der Nutzer wählt den SAF-Ordner selbst; dann greift der bestehende bestätigte Ordner-/Importpfad.
- App-Konfiguration, Release-Konfigurationsgate, generiertes Manifest und APK-Inspektor verlangen Legacy-Read. Generiertes und tatsächlich kompiliertes Manifest müssen den Read-Zugriff bei32 begrenzen. Verbotene Schreib-/Visual-Rechte bleiben verboten.
- Player, Queue, Mini-Player, ursprüngliche Musikbytes, Recovery-/Writer-Transaktionen und Cover-Fix werden nicht umgebaut.

## Reproduzierbare Hostnachweise

Originalfehler: `npx jest hooks/__tests__/useLibraryImportActions.test.tsx --runInBand -t 'native MEDIA_LIBRARY rejection'`. Vor der Korrektur beide Fälle rot mit exakt der technischen Exception im Alert; danach grün mit verständlicher Meldung und identischem gespeichertem Bibliotheksstand.

Manifest-Negativtest: `npx jest __tests__/androidManifestPermissionGate.test.ts --runInBand -t 'legacy read declaration is missing'`. Vor der Korrektur fälschlich exit0; danach korrekt abgelehnt. Zusätzliche APK-Badging-Cases prüfen cap32, falschen Cap und fehlenden Cap.

Scan-Zusammenhang: 0/1/1000/10000 echte Kandidaten über200er-Pages, deduplizierte IDs und Fortschritt; Rechteverlust nach Seite1 darf keine leere abgeschlossene Bibliothek melden. Vorhandene Tests für SAF-Grant-Verlust, Einzelfehler, Abbruch/Neustart, verspätete Checkpoints, Speicherbestätigung und Scan-Reihenfolge werden mitgeprüft.

Neue native Tests kompilieren den exakten in Expo installierten Helper. Erfolgreich im aktuellen nativen CI-Lauf: Robolectric/Context.checkSelfPermission-Prüfungen auf API24,28,29,30,31,32,33,34,35 (Read-only positiv, Write-only negativ, Entzug, fehlender Manager). API36 besitzt zusätzlich einen reinen nativen Policy-Vertragstest; das ist ausdrücklich kein Android36-Gerätebeleg. Robolectric4.14.1 bleibt unverändert, keine JDK-/Toolchain-Umstellung nur für einen zusätzlichen simulierten SDK-Wert.

### Stand vor integrierter CI

- Ursprünglicher Fehler und fehlende Legacy-Manifestdeklaration zunächst gezielt rot nachgewiesen, danach gezielt grün.
- Zusammenhangslauf: 337 funktionale Fälle bestanden; eine alte Meldungstext-Erwartung wurde auf das neue gewollte Verhalten angepasst.
- Erster vollständiger Coverage-Lauf: 435 Suiten bestanden, 2 Suiten mit3 veralteten Test-Doubles fehlgeschlagen (fehlendes Get-API und neue SAF-Callback-Verdrahtung). Diese3 Fälle sind gezielt grün; anschließend realen Library-Screen-Fall für permanent verweigerte Rechte und den echten SAF-Picker ergänzt. Letzter Integrationslauf:4 Suiten /62 Tests grün. Keine Assertions gelockert oder Tests deaktiviert.
- Coverage dieses ersten Laufs:92,96% Statements /85,34% Branches /94,11% Functions /96,04% Lines. Das ist noch keine erfolgreiche integrierte Source-CI des finalen Standes.
- TypeScript, strenger Lint und Komplexitätsgate (4313 Produktionsfunktionen) erfolgreich. Gemeinsame Import-Flow-Verdrahtung dedupliziert; Schwellen unverändert.
- Tatsächlicher Expo-Prebuild und generierter Manifest-Gate erfolgreich; READ_EXTERNAL_STORAGE cap32, READ_MEDIA_AUDIO und nötige Playback-Rechte vorhanden, breite Schreib-/Visual-Rechte ausgeschlossen.
- Postinstall prüft RNTP, neue Audio-Lesegrenze und beide Tooling-Security-Payloads erfolgreich und idempotent. Lockfile/Abhängigkeitsversionen unverändert.
- Integrierte Qualitäts-CI119996711139 vollständig erfolgreich: **437 Suiten /4227 Tests**, **182 Python** in0,434s; TypeScript, strenger Lint, Expo-/NUL-/Komplexitäts-/Bundle-/Konfigurations-/Manifestgates. Coverage92,94/85,34/94,11/96,03%. Alle3 zuvor korrigierten Integrationserwartungen sind im vollständigen Lauf bestätigt. Native119996710623 ist erfolgreich mit215 Tests in26 Suiten; Security119996711265 scheitert an den zwei unverändert abgelaufenen Ausnahmen. Kein identischer zusätzlicher Build.

## Security und offene Abnahme

Frischer Produktionsaudit: 0kritisch/23hoch/5moderat, exakt2 Advisory-Wurzeln und21 gebundene Effekte. Kompensationspayloads verifiziert; unveränderte Policy scheitert ausschließlich an braces/node-forge mit Ablaufdatum21.10.2026. Registry weiterhin braces3.0.3/node-forge1.4.0; beide offiziellen Advisories nennen keine gepatchte Veröffentlichung. Keine Ausnahme/Frist/Versionsetiketten geändert.

Native Build/JUnit und APK-Signatur sind erfolgreich; tatsächliche Mehr-API-Installation, Audio-Import und Cover-Pause/Back sind noch nicht als bestanden ausgewiesen. Der alte Geräte-/UI-Erfolg gilt nicht für neue APK-Bytes. Eine unabhängige gezielte Emulator-Diagnose wäre ein Funktionsbeleg und hebt das rote Security-/Releasegate nicht auf. Vollständige UI-/36er-Matrix und physische Samsung/Huawei/SAF/Audio-Routen/TalkBack bleiben separat nachzuweisen.

Primärquellen und technische Grundlage:
- Installierter Expo-Quellcode: node_modules/expo-media-library/android/src/main/java/expo/modules/medialibrary/MediaLibraryModule.kt; vollständige Vorher-/Nachher-SHA in scripts/patches/media-library-read-only.json.
- https://developer.android.com/training/data-storage/shared/media
- https://docs.expo.dev/versions/v57.0.0/sdk/media-library-legacy/
- https://robolectric.org/compatibility_table/
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv


## Exakte native Abnahme und APK

[CI39828111896](https://github.com/k1w1-a0style/musik-player/actions/runs/39828111896), Quelle63d5a61bad64af8af9be604e25dffbffb1298898. Nativejob119996710623 erfolgreich; Gradle20m28s. Originalartefakte auf Größe, SHA256 und volle ZIP-CRC geprüft; alle26 nativen JUnit-XMLs unabhängig summiert: **215 Tests, 0 Failures, 0 Errors, 0 Skips**. Davon36 neue Framework-Permissionfälle auf9 Robolectric-API-Stufen und1 separater API36-Policy-Vertrag. Die höchste konfigurierte Stufe35 trägt im XML den Standardmethodennamen ohne SDK-Suffix. Das sind native Unit-Runtimes und keine auf9 Geräten installierte APK.

| Merkmal | Befund |
|---|---|
| Produktquelle | `63d5a61bad64af8af9be604e25dffbffb1298898` |
| APK / Paket | 100.865.033 Bytes; `com.k1w1a0style.musikplayer`, Version1.0.0 / Code1 |
| APK-SHA256 | `9f440d79f0d9eadf0afc8059c48c01d48762424ef3ebeb5b821208c080453965` |
| Originalartefakt | [12448233207](https://github.com/k1w1-a0style/musik-player/actions/runs/39828111896/artifacts/12448233207), 48.117.862 Bytes; SHA `780acea2aec9bf89c2bfee9fcbe6152b89a9c856224948ccc8558fd11e4ed52f` |
| Zertifikat-SHA256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Signatur | Offizielles apksigner und unabhängige RSA2048-/APKv2-/Inhaltsdigestprüfung erfolgreich. Manipulierte Nutzdaten werden trotz passend neu berechneter äußerer SHA abgelehnt. |
| Tatsächliches APK-Manifest | READ_MEDIA_AUDIO und READ_EXTERNAL_STORAGE vorhanden; aapt bestätigt Legacy-maxSdkVersion32. Kein WRITE_EXTERNAL_STORAGE, MANAGE_EXTERNAL_STORAGE oder visueller Medien-Lesezugriff. |
| Android / ABIs | minSdk24 / targetSdk36; arm64-v8a, armeabi-v7a, x86, x86_64 |
| Native-JUnit-Artefakt |12449600026, 84.176 Bytes; SHA `d8cc9e7c51df1d2081606ade931534d4751559e699739c966f2a1fe1520250cb` |
| Aktueller Audit |12448026174, 2.178 Bytes; SHA `24f5ea4884b2662835623e7529e578185db54e873f74179ebb4bdd8a82da317a`; exakt2 abgelaufene Ausnahmen |

[Maschinenlesbare Herkunft und Grenzen](apk-63d5a61b-provenance.json). Die Signatur bindet APK-Bytes; die Zuordnung zum Git-Commit stammt aus Source-CI und Artefaktmetadaten. Integrierte Gesamt-CI/Required-releasechecks sind fehlgeschlagen; UIjob120007393235 wurde wegen Security nicht ausgeführt. Der vorherige Cover-Fix bleibt ohne Bestätigung auf dieser APK. Auch215 erfolgreiche native Tests ersetzen keine Installation oder vollständige UI-Abnahme.

## Gezielte externe Geräteprüfung: vorbereitet, noch nicht ausgeführt

Drei selbst erzeugte60s-Sinusdateien (MP3/M4A/FLAC, keine Nutzermusik) sind mit Original-SHA-Manifest vorbereitet. CloudConvert hat das3-Dateien-Archiv verlustfrei entpackt; die zurückgemeldeten Dateigrößen stimmen. Die lokale CDN-Rückübertragung wurde durch abgebrochene Netzwerkfreigabe blockiert. Deshalb wird keine unabhängige Rücklese-SHA behauptet.

Eine zusätzliche generische Hash-Prüfung mit YepCode wurde **von der automatischen Freigabeprüfung abgelehnt**: temporär signierte CloudConvert-Links enthalten Zugriffsdaten und sollten ohne ausdrückliche Zielautorisierung an einen weiteren Sandbox-Dienst weitergegeben werden. Die Aktion wurde nicht ausgeführt; kein Retry und keine indirekte Hash-Ausführung. Das ist eine separate Transport-/Autorisierungsgrenze, kein Appfehler und keine Änderung am Security-Audit.

Noch keine Limrun-Instanz angelegt und keine aktuelle APK installiert. Für den konkreten weiteren Dateitransfer (diese APK und ausschließlich die3 synthetischen Audios; CloudConvert als Transport und Limrun als isolierter Emulator) wird eine ausdrückliche Zustimmung eingeholt. Dies ist die vorsichtige Anwendung des genannten Autorisierungsgrundes auf den geplanten Transfer; **konkret abgelehnt wurde YepCode, nicht ein Limrun-Test**.

Danach vorhandene63d5-APK unverändert verwenden, kein identischer Neubuild: tatsächliche Android-Version und installierte Rechte feststellen; Audiozugriff ablehnen/erlauben, Settings-Rückkehr, SAF-Alternative und Datenbestand prüfen; MP3/M4A/FLAC abspielen, Pause/Resume/Back, Queue-/Coverwechsel und App-Rückkehr testen. Alle tatsächlichen Fälle mit Screenshot/Hierarchie und soweit verfügbar Runtime-/AppOps-Diagnosen zuordnen. Ein unabhängiger Funktionsbeleg hebt das weiterhin rote Security-/Releasegate nicht auf.
