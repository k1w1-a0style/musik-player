# New Architecture Compatibility Audit / Upgrade-Plan (A0)

Status: **Analyse/Dokumentation only**. Dieser Audit aktiviert die React-Native-New-Architecture nicht, ändert keine Dependencies, baut keine APK und ersetzt keinen echten Android-Geräte-Smoke.

TrackPlayer-spezifische Optionen siehe: [`docs/architecture/trackplayer-new-architecture-options.md`](./trackplayer-new-architecture-options.md).

## A0 Projektzustand

| Prüfpunkt | Aktueller Stand | Quelle / Regel | A0-Entscheidung |
|---|---:|---|---|
| Expo SDK | `~54.0.35` | `package.json` | Unverändert lassen. |
| React Native | `0.81.5` | `package.json` | Unverändert lassen. |
| React | `19.1.0` | `package.json` | Unverändert lassen. |
| `react-native-track-player` | `4.1.2` | `package.json` | Unverändert lassen; blockiert New-Architecture-Aktivierung gemäß Repo-Regel. |
| `expo-dev-client` | `~6.0.21` | `package.json` | Unverändert lassen; jeder native/dependency-relevante Wechsel benötigt später einen neuen Dev-Build. |
| Custom Native Module | `modules/expo-system-audio` / `expo-system-audio` | Lokales Expo-Modul mit Android-Implementierung | Nicht anfassen; Risiken nur dokumentieren. |
| Plattformstatus | Android-only | `app.json` enthält nur `android` in `expo.platforms` | Audit und Smoke-Plan fokussieren Android. |
| `newArchEnabled` | `false` | `app.json` | Bleibt `false`. |
| Relevante Repo-Regel | `newArchEnabled=false` solange `react-native-track-player@4.1.2` verwendet wird | `AGENTS.md` | Harte No-Go-Regel für diesen PR und spätere Opt-in-Entscheidungen. |

## A0 Scope und Nicht-Ziele

| Kategorie | A0-Festlegung |
|---|---|
| Feature-Änderungen | Keine. |
| App-Logik | Keine Umbauten. |
| Dependencies / SDKs | Keine Upgrades, keine Lockfile-Änderungen. |
| TrackPlayer | Keine Änderung an Version, Setup, Service oder Playback-Code. |
| Gradle / Kotlin / Native Code | Keine Änderungen. |
| Build / APK | Kein Build, keine APK. |
| New Architecture | Nicht aktiviert; `newArchEnabled=false` bleibt die Release-/Rollback-Vorgabe. |

## Risiko-Matrix

### 1. Playback / `react-native-track-player`

| Bereich | Aktueller Status | Risiko | Warum riskant | Benötigter Check | Benötigter Smoke-Test | Entscheidung |
|---|---|---|---|---|---|---|
| Foreground Playback | TrackPlayer `4.1.2`, New Architecture aus | Hoch | Playback ist zentraler Nutzerfluss; native Modul-/Event-Bridges können sich unter New Architecture anders verhalten. | TrackPlayer-New-Architecture-Kompatibilität und bekannte Issues für die Zielversion prüfen. | App starten, lokalen Titel importieren, Play/Pause/Nächster/Vorheriger Titel im Vordergrund testen. | **Blockiert** bis TrackPlayer-Kompatibilität geklärt ist. |
| Background Playback | TrackPlayer `4.1.2`, Android-Foreground-Service-Permissions vorhanden | Hoch | Background-Audio hängt an Service, Audio-Fokus, Notifications und Android-Lifecycle. | Service-Registrierung, AppState-Übergänge und Android-Foreground-Service-Verhalten gegen Zielversion prüfen. | Wiedergabe starten, App in Hintergrund schicken, mehrere Minuten weiterlaufen lassen, zurückkehren. | **Blockiert**. |
| Notification Controls | TrackPlayer-Notifications aktivitätskritisch | Hoch | Notification-Actions laufen über native Events und Service-Bindings. | Action-Mapping und Event-Listener unter New Architecture validieren. | Notification Play/Pause/Skip auslösen und UI-/Queue-Sync prüfen. | **Blockiert**. |
| Lockscreen Controls | Android-MediaSession/Remote Controls erwartet | Hoch | MediaSession-Callbacks können bei nativen Bridge- oder Service-Problemen ausfallen. | TrackPlayer-MediaSession-Verhalten unter Zielkombination Expo/RN/Android prüfen. | Gerät sperren, Lockscreen Controls für Play/Pause/Skip testen. | **Blockiert**. |
| Queue / Skip / Seek / Repeat / Shuffle | JS-State und TrackPlayer-Queue gekoppelt | Mittel bis hoch | Race Conditions zwischen JS-State, nativer Queue und Hydration können durch Runtime-Änderungen sichtbarer werden. | Queue-API, Event-Reihenfolge und bestehende Tests gegen Opt-in-Build prüfen. | Queue aufbauen, skippen, seeken, Repeat/Shuffle ändern, App neu öffnen. | **Blockiert** für Opt-in; nach Kompatibilitätsnachweis beobachten. |
| Service-Initialisierung | TrackPlayer-Service bleibt unverändert | Hoch | Falsche Initialisierung kann App-Start, Hintergrundwiedergabe oder Event-Dispatch brechen. | Service-Bootstrap im Dev-Build mit New Architecture gezielt prüfen. | Cold Start, Wiedergabe starten, App killen/neu öffnen, Background-Service-Verhalten beobachten. | **Blockiert**. |

### 2. Expo / React Native / Dev Client

| Bereich | Aktueller Status | Risiko | Warum riskant | Benötigter Check | Benötigter Smoke-Test | Entscheidung |
|---|---|---|---|---|---|---|
| Expo SDK 54 Status | `expo ~54.0.35` | Mittel | SDK 54 bringt definierte RN-/Native-Abhängigkeiten; New-Architecture-Verhalten muss in exakt dieser Kombination geprüft werden. | `npx expo config --type public` und Expo/RN-Kompatibilitätsnotizen für Opt-in-PR prüfen. | Dev-Client mit gleicher SDK-Basis starten und App-Start prüfen. | **Beobachten**; kein Upgrade in A0. |
| React Native Version | `react-native 0.81.5` | Mittel bis hoch | RN-Runtime, Fabric/TurboModules und Eventing sind direkt betroffen. | Ziel-RN-Version und native Abhängigkeiten gegen Expo-SDK-Vorgaben abgleichen. | Navigation, Listen, Modals, Playback-UI und Import-Flows im NewArch-Dev-Build testen. | **Beobachten**, abhängig von TrackPlayer. |
| Dev Client Neu-Build-Pflicht | `expo-dev-client ~6.0.21` vorhanden | Hoch | Native Config-/Dependency-Änderungen werden erst in einem neuen Dev-Build wirksam; Expo Go ist nicht ausreichend. | Prüfen, ob ein geplanter Opt-in-PR einen neuen Android-Dev-Build auslöst und dokumentiert. | Installierter Dev-Build zeigt erwartete Config und App startet auf echtem Android-Gerät. | **Blockiert** ohne Build-Plan. |
| Dev Client vs Release/Preview Build | Release-/Rollback-Pfad bleibt NewArch aus | Mittel | Ein erfolgreicher Dev-Smoke beweist nicht automatisch Release-/Preview-Verhalten; unterschiedliche Profile können abweichen. | Build-Profile und Config-Ausgabe getrennt dokumentieren. | Nach Opt-in Dev-APK testen; Release/Preview erst nach separater Freigabe. | **Beobachten**. |

### 3. Custom Native Module `modules/expo-system-audio`

| Bereich | Aktueller Status | Risiko | Warum riskant | Benötigter Check | Benötigter Smoke-Test | Entscheidung |
|---|---|---|---|---|---|---|
| Modul allgemein | Lokales Expo-Modul `ExpoSystemAudio` | Mittel bis hoch | Lokale Native Module müssen unter der Ziel-Expo-/RN-New-Architecture-Kombination korrekt geladen werden. | Expo-Modules-Kompatibilität für SDK 54/RN 0.81 prüfen; keine Codeänderung in A0. | App-Start im Dev-Build; `SystemAudio.isAvailable` und Fallback-Verhalten prüfen. | **Beobachten**, vor Opt-in dokumentieren. |
| Equalizer | Native Android-Equalizer-Brücke (`eqInit`, `eqSetEnabled`, `eqSetBandLevel`, `eqRelease`) | Mittel | AudioEffect-Lifecycle ist geräte- und Session-abhängig; Bridge-Fehler können Crashes oder No-op-Verhalten erzeugen. | API-Aufrufe und Fehlerpfade gegen NewArch-Dev-Build prüfen. | EQ öffnen, Preset/Bänder ändern, Playback fortsetzen, App schließen. | **Beobachten**. |
| Palette Extraction | Native Bitmap-/Palette-Extraktion | Mittel | Bitmap-Decoding kann Speicher-/Threading-Probleme zeigen; New Architecture kann Timing und Module-Aufrufpfade verändern. | Große/ungültige Bilder, `content://`, `file://` und Data-URIs im Dev-Build prüfen. | Cover mit Palette laden, große Cover testen, keine Crashes/OOM. | **Beobachten**. |
| Embedded Artwork Cache | Native Extraktion und Cache unter App-Cache-Verzeichnis | Mittel | Dateisystem, MediaMetadataRetriever und Cache-Trim müssen mit Android-URI-Rechten stabil bleiben. | Cache-Pfade, MIME-Erkennung und Fehlerlogs im Dev-Build prüfen. | Titel mit eingebettetem Cover importieren; Artwork extrahieren; App neu starten. | **Beobachten**. |
| N-25 Bitmap Decode-Härtung | Bestehende Decode-Grenzen/Härtung bleiben unverändert | Mittel | Härtung ist sicherheits- und stabilitätsrelevant; Regressionen könnten OOM oder blockierende Decodes verursachen. | Bounds/Byte-Limits und Remote-URI-Blocking in Tests/Smoke beibehalten. | Sehr großes Cover, defektes Cover und Remote-URI-Fall prüfen. | **Beobachten**. |

### 4. Media / Files

| Bereich | Aktueller Status | Risiko | Warum riskant | Benötigter Check | Benötigter Smoke-Test | Entscheidung |
|---|---|---|---|---|---|---|
| MediaLibrary Import | Expo MediaLibrary, Android-Audio-Permissions | Mittel | Import hängt an Android-Permissions, URI-Lesen und Expo-Modulverhalten. | Expo Config Gate und Permission Gate prüfen. | MediaLibrary importieren, Metadaten/Cover laden, Playback starten. | **Beobachten**. |
| SAF / `content://` | SAF/content-URIs werden als read-only behandelt | Mittel bis hoch | Persistierte URI-Rechte und read-only-Grenzen dürfen nicht durch Runtime-/Native-Änderungen brechen. | SAF-Flows und Write-Guards für `content://` validieren. | SAF-Ordner scannen; Tag-/Cover-Write auf `content://` muss blockiert bleiben. | **Blockiert** für Release, wenn ungeklärt. |
| `file://` | Lokale Dateien sind Write-Kandidaten | Mittel | Tag-/Cover-Writes benötigen sichere Dateioperationen, Backup/Temp/Verify und Rollback. | TagWriter-Gates, FileSystem-APIs und URI-Normalisierung prüfen. | Lokale Datei taggen, Cover ersetzen/entfernen, Playback danach prüfen. | **Beobachten**. |
| TagWriter | Bestehender Sicherheits-/Rollback-Pfad | Mittel | Native/JS-Timing darf Backup/Temp/Verify nicht unterbrechen. | Unit-/Integrationstests und manuelle Write-Flows gegen Dev-Build prüfen. | Tag ändern, Fehlerfall simulieren soweit möglich, Datei bleibt spielbar. | **Beobachten**. |
| Cover Replace/Remove | Nur unterstützte schreibbare Titel | Mittel | Cover-Operationen kombinieren Picker, Cache, TagWriter und UI-State. | Read-only-Guards und unterstützte MIME-/Dateitypen prüfen. | Cover ersetzen und entfernen für lokale Datei; externes Cover bleibt nicht entfernbar. | **Beobachten**. |
| Read-only für `content://` | Muss erhalten bleiben | Hoch | Falscher Schreibversuch auf SAF/MediaStore kann Datenverlust, Crashes oder Permission-Probleme erzeugen. | Explizite No-Write-Regeln und Tests prüfen. | `content://`-Titel bearbeiten versuchen; UI blockiert Write sauber. | **Blockiert** bei Regression. |

### 5. UI / RN Runtime

| Bereich | Aktueller Status | Risiko | Warum riskant | Benötigter Check | Benötigter Smoke-Test | Entscheidung |
|---|---|---|---|---|---|---|
| Gesture Handler | `react-native-gesture-handler ~2.28.0` | Mittel | Gesten hängen an nativen Handlern und Navigation-Interaktion. | Kompatibilität mit RN 0.81/New Architecture prüfen. | Mini-Player, Slider, Listen-Scroll, Swipe-/Touch-Flows bedienen. | **Beobachten**. |
| Screens | `react-native-screens ~4.16.0` | Mittel | Native Screens/Fabric können Navigation-Lifecycle und Mounting ändern. | Navigation-Stack und Screen-Options im Dev-Build prüfen. | Zwischen Library, Now Playing, Settings/Modals navigieren. | **Beobachten**. |
| Navigation | React Navigation 7.x | Mittel | State-Persistenz, Screen-Mounting und Event-Reihenfolge können sich ändern. | Navigation-State und Deep/App-Restart-Flows prüfen. | Cold Start, Tab-Wechsel, Now-Playing-Aufruf, Back-Verhalten. | **Beobachten**. |
| Modal-Verhalten | App nutzt modale Flows für Editing/Picker-nahe UX | Mittel | Fabric/Concurrent Rendering kann Fokus, A11y und Dismiss-Handling beeinflussen. | Modal-Mounting, Back-Button, Accessibility-Fokus prüfen. | Tag-/Cover-/Queue-Modals öffnen, speichern, abbrechen, Back drücken. | **Beobachten**. |
| Concurrent Rendering Risiko | React 19.1.0 | Mittel bis hoch | Hydration, derived state und Effekte können durch andere Scheduling-Timings anfälliger werden. | Kritische Effects/State-Hydration unter Strict-/Concurrent-Verhalten beobachten. | App mit gespeicherter Library/Queue neu starten; keine Doppelaktionen oder leeren States. | **Beobachten**. |
| State/Hydration Risiko | Persistierte Library, Queue, Favoriten, Playlists | Mittel bis hoch | Playback-State und persistierter App-State müssen synchron bleiben. | Storage-/Hydration-Tests und Runtime-Logs prüfen. | App beenden/neu öffnen; Queue, Favoriten, Playlists und aktueller Titel bleiben konsistent. | **Beobachten**, Release-blockierend bei Regression. |

### 6. CI / Gates

| Bereich | Aktueller Status | Risiko | Warum riskant | Benötigter Check | Benötigter Smoke-Test | Entscheidung |
|---|---|---|---|---|---|---|
| Expo Config Gate | Prüft Release-Konfiguration inklusive `newArchEnabled` | Niedrig bis mittel | Gate muss NewArch-Testmodus später erlauben, ohne sicheren Rollback dauerhaft zu blockieren. | Bestehenden Gate-Test in A0 ausführen; spätere Opt-in-Gate-Strategie separat dokumentieren. | Kein Geräte-Smoke; Config-Ausgabe reicht für Gate. | **Unkritisch** in A0. |
| Android Manifest Permission Gate | Prüft unerwünschte Permissions | Niedrig bis mittel | NewArch-/Build-Änderungen dürfen keine regressiven Permissions einführen. | Manifest-Permission-Gate ausführen. | Nach Dev-Build Manifest/Runtime-Permissions gegenprüfen. | **Unkritisch** in A0. |
| Tests / Coverage | Jest/Typecheck/Lint vorhanden | Mittel | Unit-Gates erkennen keine nativen Runtime-Probleme; Geräte-Smoke bleibt Pflicht. | A0-Checks ausführen und Ergebnis im PR dokumentieren. | Nicht ausreichend für NewArch-Freigabe. | **Beobachten**. |
| Release-Handoff | Release-Doku enthält NewArch-Smoke-Hinweise | Mittel | Handoff darf NewArch nicht als freigegeben markieren und Rollback nicht blockieren. | Release-Doku auf Audit verlinken. | Nach Opt-in nur mit echtem Dev-APK/Geräte-Smoke freigeben. | **Beobachten**. |

## Empfohlene Upgrade- und Opt-in-Reihenfolge

| Phase | Ziel | Inhalt | Nicht enthalten / Exit-Kriterium |
|---|---|---|---|
| A0 | Audit/Plan | Dieser PR: Projektzustand, Risiko-Matrix, Go/No-Go-Regeln, Release-Doku-Verweis. | Keine Aktivierung, keine Builds, keine Upgrades. |
| A1 | TrackPlayer-Kompatibilität klären | Stabile verfügbare TrackPlayer-Versionen recherchieren, New-Architecture-Kompatibilität prüfen, Breaking Changes dokumentieren, Upgrade nur vorschlagen. | Kein Upgrade in A1; Exit: dokumentierte Empfehlung. |
| A2 | Optionaler TrackPlayer-Upgrade-PR | Falls A1 sinnvoll ist: TrackPlayer separat upgraden, Playback-Tests erweitern. | New Architecture bleibt weiterhin aus; Exit: grüne Gates und Playback-Smoke ohne NewArch. |
| A3 | Neuer Dev-Build ohne NewArch | Nach Native-/Dependency-Änderungen einen neuen Android-Dev-Build ohne NewArch erstellen. | Kein NewArch-Opt-in; Exit: echter Geräte-Smoke ohne NewArch erfolgreich. |
| A4 | NewArch-Testmodus als eigener PR | `newArchEnabled` testweise nur in separatem PR aktivieren; CI-Gates an Testmodus anpassen, ohne sicheren Release-/Rollback-Pfad dauerhaft zu blockieren. | Kein Release-Claim ohne Smoke; Exit: PR zeigt klaren Rollback-Pfad. |
| A5 | NewArch Dev-APK und Android-Smoke | Dev-APK bauen und auf echtem Android-Gerät testen. | Kein Release-Handoff ohne erfolgreiche Smoke-Checkliste. |
| A6 | Entscheidung | Behalten, rollback oder weitere Fix-PRs. | Entscheidung explizit dokumentieren; Rollback darf nicht durch Gate-Design blockiert werden. |

## Go-/No-Go-Regeln

### New Architecture darf erst aktiviert werden, wenn

- TrackPlayer-Kompatibilität für die Zielversion geklärt und dokumentiert ist.
- Risiken des Custom Native Module `modules/expo-system-audio` dokumentiert sind.
- Ein konkreter Android-Dev-Build-Plan steht.
- Eine Smoke-Checkliste für Playback, Media/File-Flows, Native Module und UI/Hydration vorhanden ist.
- Ein Rollback-Pfad dokumentiert ist.
- Das Release-Gate einen sicheren Rollback auf `newArchEnabled=false` nicht dauerhaft blockiert.

### New Architecture darf nicht aktiviert werden, wenn

- `react-native-track-player@4.1.2` weiter gepinnt ist und `AGENTS.md` unverändert `newArchEnabled=false` verlangt.
- Kein echter Android-Dev-Build geplant ist.
- Kein Geräte-Smoke möglich ist.
- Build- oder Runtime-Risiken ungeklärt sind.

## A0 Ergebnis

- `newArchEnabled` bleibt `false`.
- `react-native-track-player` bleibt `4.1.2`.
- Dependencies, SDKs, Gradle/Kotlin, AndroidManifest, Native-Code, Playback-Code, Storage, TagWriter, CoverPicker und UI-Komponenten bleiben unverändert.
- Dieser Audit ist ein Planungsartefakt und keine Kompatibilitätsfreigabe.
