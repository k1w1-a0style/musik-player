# TrackPlayer New-Architecture Options (A1)

## Status

- Analyse/Dokumentation only.
- Keine Dependencies geändert.
- Kein Build ausgeführt.
- Keine APK erstellt.
- `newArchEnabled` bleibt `false`.
- Recherchezeitpunkt: 2026-06-13 UTC.

## Aktueller Projektstand

| Prüfpunkt | Wert | Quelle / Hinweis | A1-Entscheidung |
|---|---:|---|---|
| Expo SDK | `~54.0.35` | `package.json` | Nur dokumentiert, nicht geändert. |
| React Native | `0.81.5` | `package.json` | Nur dokumentiert, nicht geändert. |
| React | `19.1.0` | `package.json` | Nur dokumentiert, nicht geändert. |
| `react-native-track-player` | `4.1.2` | `package.json`; `npm view react-native-track-player version` meldet `4.1.2` als `latest` | Nur dokumentiert, nicht geändert. |
| `expo-dev-client` | `~6.0.21` | `package.json` | Nur dokumentiert, nicht geändert. |
| Plattform | Android-only | `app.json` / A0-Audit | A1 fokussiert Android Playback, Notification, Lockscreen/MediaSession, Background. |
| `newArchEnabled` | `false` | `app.json` | Bleibt `false`. |
| AGENTS.md-Regel | `newArchEnabled=false` solange `react-native-track-player@4.1.2` verwendet wird | `AGENTS.md` | Harte No-Go-Regel für diesen PR. |

## Offizielle Quellen und Rechercheergebnis

### RNTP V4 (`react-native-track-player`)

| Thema | Rechercheergebnis | Quelle |
|---|---|---|
| Aktuelle V4-Dokumentation | Die öffentlich erreichbare V4-Dokumentation ist Version `4.1`. | [RNTP 4.1 Intro](https://rntp.dev/docs/intro) |
| Paket / aktuelle V4-Version | `react-native-track-player` bleibt das V4-Paket; npm meldet `4.1.2` als `latest`. | `npm view react-native-track-player version license time.modified dist-tags --json` |
| Support-Status | V5-Dokumentation/Release Notes beschreiben V4 als auf dem `v4`-Branch eingefroren und ohne weitere Updates. | [RNTP V5 Introduction](https://www.rntp.dev/docs/introduction), [GitHub Release v5.0.0](https://github.com/doublesymmetry/react-native-track-player/releases/tag/v5.0.0) |
| New-Architecture-Status | Für V4 wurde in den offiziellen V4-Dokumentationsseiten kein New-Architecture-Supportversprechen gefunden. Gleichzeitig verlangt die Repo-Regel, mit `react-native-track-player@4.1.2` `newArchEnabled=false` zu behalten. | [RNTP 4.1 Intro](https://rntp.dev/docs/intro), `AGENTS.md` |
| Android Background Playback | V4 sagt, Android Background Playback funktioniere grundsätzlich ohne Zusatzschritte; App-Kill-Verhalten wird über `android.appKilledPlaybackBehavior` in `updateOptions` gesteuert. | [RNTP 4.1 Background Mode](https://rntp.dev/docs/basics/background-mode), [RNTP 4.1 AndroidOptions](https://rntp.dev/docs/api/objects/android-options) |
| Notification Controls | V4 beschreibt Android Notification-Sichtbarkeit abhängig von `AppKilledPlaybackBehavior` und laufendem Playback-Service; Notification-Aktionen werden über Capabilities/Notification-Capabilities konfiguriert. | [RNTP 4.1 Background Mode](https://rntp.dev/docs/basics/background-mode), [RNTP 4.1 UpdateOptions](https://rntp.dev/docs/api/objects/update-options) |
| MediaSession / Lockscreen Controls | V4 beschreibt Media Controls für Bluetooth, Lockscreen, Notification, Smartwatch und Auto; `Capability` enthält Play/Pause/Skip/Seek/Stop usw. | [RNTP 4.1 Intro](https://rntp.dev/docs/intro), [RNTP 4.1 Capability](https://rntp.dev/docs/api/constants/capability), [RNTP 4.1 Platform Support](https://rntp.dev/docs/basics/platform-support) |
| Playback Service | V4 empfiehlt Remote-Event-Listener in den Playback Service zu legen, weil UI-Komponenten im Hintergrund unmounted werden können. | [RNTP 4.1 Playback Service](https://rntp.dev/docs/basics/playback-service) |
| V3 → V4 Migration | V4-Migration ist vorhanden; relevant sind u. a. neue/umbenannte APIs wie Active-Track-APIs und detailliertere Metadata Events. Das Projekt ist bereits auf V4, daher ist dies nur Kontext. | [RNTP V3.2 → V4 Migration](https://rntp.dev/docs/4.0/v4-migration) |

### RNTP V5 / Nachfolgepaket

| Thema | Rechercheergebnis | Quelle |
|---|---|---|
| Paketname | V5 wird als neues npm-Paket `@rntp/player` ausgeliefert; V4 bleibt als `react-native-track-player` bestehen. | [GitHub Release v5.0.0](https://github.com/doublesymmetry/react-native-track-player/releases/tag/v5.0.0), [RNTP Installation](https://www.rntp.dev/docs/installation) |
| Aktuelle stabile Version | `npm view @rntp/player version` meldet `5.5.0`; RNTP-Changelog listet `v5.5.0` vom 2026-06-06. | `npm view @rntp/player version license time.modified dist-tags --json`, [RNTP Changelog](https://www.rntp.dev/changelog) |
| New Architecture Pflicht | V5 verlangt React Native New Architecture mit Fabric + TurboModules; Installationsdocs zeigen `newArchEnabled=true`. | [RNTP Installation](https://www.rntp.dev/docs/installation), [GitHub Release v5.0.0](https://github.com/doublesymmetry/react-native-track-player/releases/tag/v5.0.0) |
| Rewrite | V5 ist laut offiziellen Quellen ein kompletter Rewrite und nicht rückwärtskompatibel zu V4. | [RNTP Introduction](https://www.rntp.dev/docs/introduction), [GitHub Release v5.0.0](https://github.com/doublesymmetry/react-native-track-player/releases/tag/v5.0.0) |
| API-Kompatibilität mit V4 | Nicht API-kompatibel; native Schichten und JS-API wurden neu geschrieben, kein automatischer V4→V5-Migrationspfad. | [GitHub Release v5.0.0](https://github.com/doublesymmetry/react-native-track-player/releases/tag/v5.0.0) |
| Lizenzmodell / kommerzielle Einschränkungen | V5 ist dual-/kommerziell lizenziert: private und Bildung-Nutzung frei; kommerzielle Nutzung benötigt bezahlte Lizenz. Preise/Pläne beginnen mit RNTP Pro für eine Produktions-App; White-label/Client-Delivery benötigt gesonderte Lizenzen. | [RNTP Terms](https://www.rntp.dev/terms), [RNTP Pricing](https://www.rntp.dev/pricing) |
| React-Native-Anforderung | React Native `0.74` oder neuer. Das Projekt mit RN `0.81.5` erfüllt diese Untergrenze grundsätzlich, aber New Architecture ist aus. | [RNTP Installation](https://www.rntp.dev/docs/installation), `package.json` |
| Expo / Dev Client | V5 dokumentiert React-Native-New-Architecture-Setup; für dieses Expo-Dev-Client-Projekt würde jede native Dependency-Änderung einen neuen Android Dev Build erfordern. Kein offizielles Expo-SDK-54-spezifisches V5-Kompatibilitätsversprechen wurde in den RNTP-Docs gefunden. | [RNTP Installation](https://www.rntp.dev/docs/installation), A0-Audit |
| Android-Support | V5 verlangt Android API 21+; Android benötigt laut Installation keine zusätzlichen Schritte außer Autolinking unter New Architecture. | [RNTP Installation](https://www.rntp.dev/docs/installation) |
| Background Playback | V5 bewirbt/ dokumentiert Background Playback, inklusive Weiterlaufen bei Background, Screen Off und App-Wechsel. | [RNTP Introduction](https://www.rntp.dev/docs/introduction), [RNTP Playback](https://www.rntp.dev/docs/playback) |
| Notification/Lockscreen Controls | V5 Remote Controls konfigurieren Lock screen, Notification und native Media Session; Standardhandling ist nativ, JS-Handler nur bei Bedarf. | [RNTP Quick Start](https://www.rntp.dev/docs/quick-start), [RNTP Playback](https://www.rntp.dev/docs/playback) |
| Breaking Changes | `@rntp/player`, neue Command-/MediaItem-API, synchrone Methoden, neue Hooks (`useIsPlaying`, `useActiveMediaItem`), kein automatischer Migrationspfad. | [GitHub Release v5.0.0](https://github.com/doublesymmetry/react-native-track-player/releases/tag/v5.0.0), [RNTP Quick Start](https://www.rntp.dev/docs/quick-start), [RNTP Playback](https://www.rntp.dev/docs/playback) |

### Expo SDK 54 / RN 0.81 Kontext

| Thema | Rechercheergebnis | Quelle |
|---|---|---|
| Zielkombination NewArch-fähig? | Expo SDK 54 enthält React Native 0.81 und React 19.1 und fokussiert New Architecture. Die Kombination ist grundsätzlich NewArch-fähig, sofern Dependencies/native Module kompatibel sind. | [Expo SDK 54](https://expo.dev/sdk/54), [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54) |
| SDK 54 Opt-in/Opt-out | Expo dokumentiert: SDK 53/54 haben New Architecture standardmäßig an; man kann sie in SDK 54 und früher explizit deaktivieren. Dieses Projekt hat sie bewusst deaktiviert. | [Expo New Architecture Guide](https://docs.expo.dev/guides/new-architecture/) |
| SDK 55 Relevanz | Expo dokumentiert, dass SDK 55 und später vollständig auf New Architecture laufen und diese nicht deaktiviert werden kann; SDK 54 ist die letzte Version mit abschaltbarer New Architecture. | [Expo New Architecture Guide](https://docs.expo.dev/guides/new-architecture/) |
| Risiko für Upgrade-Pfad | Mit RNTP 4.1.2 blockiert die Repo-Regel NewArch. SDK 55 würde die Legacy-Ausweichoption entfernen; deshalb muss TrackPlayer/NewArch vor einem späteren SDK-55+-Upgrade geklärt werden. | [Expo New Architecture Guide](https://docs.expo.dev/guides/new-architecture/), `AGENTS.md`, A0-Audit |

## Recherchierte Optionen

| Option | Vorteile | Nachteile | NewArch-Fähigkeit | Release-Sicherheit | Aufwand | Risiko | Empfehlung |
|---|---|---|---|---|---|---|---|
| Option 1 — Auf `react-native-track-player@4.1.2` bleiben | Keine Dependency-/SDK-/Native-Änderung; bestehende Tests und Mocks bleiben gültig; entspricht AGENTS.md-Regel; minimiert Playback-Regressionsrisiko kurzfristig. | V4 ist laut V5-Dokumentation/Release Notes eingefroren; kein belegtes offizielles V4-NewArch-Supportversprechen; späterer SDK-55-Pfad bleibt blockiert. | Für dieses Projekt: **nein**, weil `newArchEnabled=false` verpflichtend bleibt, solange `4.1.2` verwendet wird. | Hoch für kurzfristige Dokumentations-/Release-Ziele ohne NewArch; niedrig für späteren SDK-55+-Pfad. | Gering. | Mittel: technischer Schuldenpunkt bleibt bestehen; zukünftige Expo/RN-Upgrades werden enger. | **Empfohlen für jetzt.** Keine Änderung in A1; zuerst Nutzungs-/Testabdeckung kartieren und Upgrade-Spike planen. |
| Option 2 — RNTP V4 minor/patch prüfen | Könnte theoretisch Fixes ohne Rewrite bringen. | `npm view react-native-track-player` meldet `4.1.2` als `latest`; V5-Quellen sagen, V4 bleibt auf letztem Release eingefroren. | Kein belegter NewArch-Support; Repo-Regel bleibt bei `4.1.2` aktiv. | Keine praktische Upgrade-Option gefunden. | Gering für Prüfung, aber aktuell kein Zielrelease. | Niedrig bis mittel: Recherche zeigt keinen besseren V4-Pfad; vermeidet aber keine SDK-55-Frage. | **Nicht als eigener Upgrade-PR einplanen**, solange keine neue offizielle V4-Patchversion erscheint. |
| Option 3 — RNTP V5 / neues Paket `@rntp/player` prüfen | Offiziell NewArch-nativ; aktive V5-Entwicklung; Android Media3, native Remote Controls, Background Playback, Caching/Preloading. | Neues Paket, kommerzielle Lizenzklärung, kompletter Rewrite, nicht V4-kompatibel, kein automatischer Migrationspfad, NewArch Pflicht. | **Ja, aber nur mit New Architecture aktiviert**; dadurch in diesem Projekt nicht direkt kompatibel mit A1-Scope. | Niedrig für Direktumstieg; erst nach Spike/Dev-Build/Android-Smoke bewertbar. | Hoch: API-Migration, Queue/Service/Events/Hooks/Tests/Native Build. | Hoch: Playback, Background, Notification/Lockscreen, App-Kill, Audio Focus, License/Procurement. | **Nur separater Spike-Branch**, kein Produktiv-PR ohne Lizenzentscheidung, Migrationsplan, Testausbau, Dev-Build und echtes Android-Smoke. |
| Option 4 — NewArch später erst mit Expo/RN/TrackPlayer-Gesamtupgrade | Keine Zwischenmigration; Upgrade kann auf SDK-55+-Zwang, NewArch und TrackPlayer zusammen optimiert werden; weniger doppelte native Builds. | Größerer Umbau später; mehr gleichzeitige Variablen; Zeitdruck wenn SDK 55+ benötigt wird. | Möglich, wenn TrackPlayer-/Native-Module-Pfad vorher entschieden ist. | Mittel: besser planbar als Direktumstieg, aber größerer Integrations-PR. | Mittel bis hoch. | Mittel bis hoch: kumulierte Risiken; aber kontrollierbar mit A2/A3-Spikes und Smoke-Gates. | **Empfohlen als strategischer Pfad**: erst Tests/Mappings, dann Spike, danach Upgrade-Sequenz entscheiden. |

## Code-Mapping: aktuelle TrackPlayer-Verwendung

Gesucht mit:

```sh
rg "TrackPlayer|RepeatMode|Event|Capability|State|usePlaybackState|useProgress|setupPlayer|registerPlaybackService|addEventListener|updateOptions" .
rg -n "react-native-track-player|TrackPlayer\.|usePlaybackState|useProgress|RepeatMode|Capability|Event\." -g '!node_modules/**' -g '!docs/**' -g '!coverage/**' .
rg -n "react-native-track-player" -g '!node_modules/**' -g '!docs/**' -g '!coverage/**' . | sort
```

### Betroffene Produktionsdateien

| Datei | Genutzte RNTP-APIs | Kritische Stellen | Mögliche V5-/NewArch-Migrationspunkte |
|---|---|---|---|
| `index.js` | `TrackPlayer.registerPlaybackService` | Service-Registrierung vor Root-Komponente; zentrale Voraussetzung für Remote Controls im Hintergrund. | V5 verwendet `@rntp/player` und `registerBackgroundEventHandler`; Registrierungsmuster ändert sich laut Quick Start. |
| `utils/trackPlayerSetup.ts` | `setupPlayer`, `updateOptions`, `Capability`, `AppKilledPlaybackBehavior`, `UpdateOptions` | Android App-Kill-Verhalten `StopPlaybackAndRemoveNotification`, Notification/compact capabilities, Progress-Event-Intervall. | V5 ersetzt Commands/Capabilities durch `setCommands` / `PlayerCommand`; App-Kill-Verhalten heißt in V5-Changelog `android.taskRemovedBehavior`. |
| `services/PlaybackService.ts` | `addEventListener`, `Event.RemotePlay`, `RemotePause`, `RemoteStop`, `RemoteNext`, `RemotePrevious`, `RemoteSeek`, `RemoteJumpForward`, `RemoteJumpBackward`; `play`, `pause`, `stop`, `skipToNext`, `skipToPrevious`, `seekTo`, `seekBy` | Remote Controls laufen im Playback Service; Fehler werden nur geloggt; Aktionen laufen durch Native-Mutation-Lock. | V5 behandelt Remote Controls standardmäßig nativ; JS-Handler nur bei `js`/`hybrid` bzw. Android Background Handler. Event-Payloads und Handler-Registrierung prüfen. |
| `contexts/usePlaybackControls.ts` | `usePlaybackState`, `State`, `stop` | UI-Zustand für Playing/Buffering/Loading; Stop direkt ohne Lock. | V5 hat neue Hooks (`usePlaybackState`, `useIsPlaying`) und synchrone Methoden; State-Namen/Buffering-Handling prüfen. |
| `contexts/playbackControlHelpers.ts` | `getPlaybackState`, `State.Playing`, `pause`, `play`, `seekTo`, `skipToNext`, `getProgress`, `skipToPrevious`, `setRepeatMode`, `setVolume` | Play/Pause/Seek/Skip/Repeat/Volume sind Kernflows; Previous restartet bei Position >3s. | V5-Methoden sind synchron; RepeatMode-Werte heißen `Off`, `One`, `All` statt V4 `Off`, `Track`, `Queue`; Skip-API kann `skipToIndex` statt `skip(index)` benötigen. |
| `contexts/playbackQueueActionHelpers.ts` | `reset`, `add`, `seekTo`, `play`, `getActiveTrack`, optional `skip`, `getProgress` | Queue-Rebuild, Wiederverwendung nativer Queue, Resume-Position, Shuffle bei laufender Wiedergabe. | V5-Queue-API arbeitet mit `setMediaItems`, MediaItem-Feldern und synchronen Methoden; `getActiveTrack` wird zu Active Media Item-Konzept. |
| `contexts/musicHydrationNativeQueue.ts` | `reset`, `add` | Hydration ersetzt native Queue; Fehlerpfad resetet Queue. | V5 Hydration muss `setMediaItems`/neue Queue-Semantik nutzen und App-Start-Reihenfolge mit NewArch testen. |
| `contexts/musicHydrationPlaybackSettings.ts` | `setVolume`, `setRepeatMode` | Restore von Volume/Repeat aus Storage. | V5 RepeatMode-Mapping anpassen; synchrone Calls/Fehlerbehandlung neu bewerten. |
| `contexts/useCurrentSongSync.ts` | `addEventListener`, `Event.PlaybackActiveTrackChanged` | Aktueller Song wird aus Active-Track-Event synchronisiert und persistiert. | V5 nutzt MediaItem/MediaItemTransition bzw. `useActiveMediaItem`; Event-Namen/Payloads ändern. |
| `contexts/PlaybackProgressContext.tsx` | `useProgress(500)` | Sekunden→Millis-Konvertierung für UI. | V5 `useProgress` existiert, aber Rückgabe-/Update-Semantik prüfen. |
| `contexts/libraryActionHelpers.ts` | `updateMetadataForTrack` | Metadata/Artwork-Update anhand Queue-Index. | V5 Changelog beschreibt `updateMetadata` / MediaItem-Metadaten und automatische Stream-Metadata; Queue-Index-Update muss neu gemappt werden. |
| `contexts/useLibraryActions.ts` | `reset`, `add` | Bibliotheksänderungen ersetzen native Queue und säubern CurrentSong. | V5 Queue-Rebuild mit MediaItems testen. |
| `utils/audioPlaybackModes.ts` | RNTP `RepeatMode` | Mapping App-Repeat `off/all/one` auf V4 `Off/Queue/Track`. | V5-Mapping auf `Off/All/One` ändern. |
| `utils/trackPlayerTrack.ts` | V4 Track-Objektfelder `id`, `url`, `title`, `artist`, `album`, `artwork`, `duration` | Einheitliches Mapping lokaler Songs zu RNTP Tracks; Artwork/Duration wichtig für Notification/Lockscreen. | V5 MediaItem-Felder (`mediaId`, `url`, `artworkUrl`, Extras) neu mappen. |

### Tests und Test-Mocks

| Datei / Bereich | Abdeckung heute | Migrationsrelevanz |
|---|---|---|
| `__mocks__/react-native-track-player.js` | In-Memory-Mock für Queue, State, Events, Hooks, Setup/Options. | Muss bei V5 komplett auf `@rntp/player` und synchrone API/Events umgebaut werden. |
| `utils/__tests__/trackPlayerSetup.test.ts` | Setup-/Already-Initialized-/Options-Fehlerpfade. | Muss V5 `setupPlayer` / `setCommands` / Task-Removed-Optionen abdecken. |
| `services/__tests__/PlaybackService.test.ts` | Remote-Event-Handler und Fehlerpfade. | Muss V5 Background/Remote-Handling-Strategie neu testen; bei Native-Handling evtl. weniger JS-Service. |
| `contexts/__tests__/playbackControlHelpers.test.ts`, `contexts/__tests__/usePlaybackControls.test.tsx` | Play/Pause/Seek/Skip/Repeat/Volume und UI-State. | RepeatMode, State, sync/async Semantik, Skip-Verhalten aktualisieren. |
| `contexts/__tests__/playbackQueueActionHelpers.test.ts`, `contexts/__tests__/musicHydrationNativeQueue.test.ts` | Queue-Rebuild, Hydration, Shuffle/Resume. | Größter V5-Risiko-/Umbaupunkt wegen MediaItem-/Queue-API. |
| `contexts/__tests__/useCurrentSongSync.test.tsx` | Active-Track-Event-Sync. | Event/Payload/API wird sehr wahrscheinlich geändert. |
| `contexts/__tests__/PlaybackProgressContext.test.tsx` | Progress-Provider und Millisekundenkonvertierung. | V5 `useProgress` prüfen. |
| `contexts/__tests__/libraryActionHelpers.test.ts`, `contexts/__tests__/useLibraryActions.test.tsx` | Metadata-/Queue-Updates bei Bibliotheksänderungen. | Queue-Index-/Metadata-Update muss mit V5 MediaItems neu belegt werden. |

### Fehlende Tests / Smokes vor V5 oder NewArch

- A2 erweitert die Unit-/Hook-Testabdeckung für die aktuelle `react-native-track-player@4.1.2`-Nutzung (Remote Events, Controls, Queue/Hydration, CurrentSong, Progress und Metadata), bleibt aber ein Sicherheits-/Test-PR ohne Upgrade und ohne NewArch-Aktivierung.
- Echten Android-Dev-Build mit New Architecture gibt es in A1 nicht.
- Kein automatisierter End-to-End-Test für Android Notification Controls.
- Kein automatisierter End-to-End-Test für Lockscreen/MediaSession Controls.
- Kein automatisierter End-to-End-Test für Bluetooth/Headset Remote Events.
- Kein automatisierter Test für Background Playback nach App-Wechsel, Screen-Off, App-Kill/Task-Removal und Neustart.
- Kein automatisierter Test für Android Audio Focus / Ducking / Telefonunterbrechung.
- Kein Test mit realen lokalen `file://`/SAF-Titeln, Artwork und Duration in nativer Notification.
- Kein Lizenz-/Procurement-Gate für `@rntp/player`.

## Migrations-Risiko-Matrix

| Bereich | Aktuelle API / Datei | Risiko bei Upgrade | Warum riskant | Benötigter Test | Empfehlung |
|---|---|---|---|---|---|
| Player Setup | `setupPlayer`, `updateOptions` in `utils/trackPlayerSetup.ts` | Hoch | V5 trennt Setup/Commands neu und verlangt New Architecture; falsche Startreihenfolge kann Playback komplett verhindern. | Unit-Test für Setup/Commands plus Android Dev-Build-App-Start. | Separat migrieren, nicht zusammen mit Produktiv-NewArch-Opt-in. |
| Playback Service | `registerPlaybackService` in `index.js`, `PlaybackService.ts` | Hoch | V5 setzt stärker auf native Remote-Control-Behandlung und Android Background Event Handler; alte Service-Events können nicht 1:1 passen. | Remote Play/Pause/Next/Previous/Seek aus Notification/Lockscreen/Bluetooth. | Spike mit echter Android-Hardware. |
| Queue Handling | `reset`, `add`, optional `skip`, `getActiveTrack` in `contexts/playbackQueueActionHelpers.ts`, `contexts/useLibraryActions.ts`, `contexts/musicHydrationNativeQueue.ts` | Hoch | Queue-Rebuild und Wiederverwendung sind zentral; V5 MediaItem-/Queue-API ist nicht V4-kompatibel. | Unit-Tests für Play-Song, Shuffle, Hydration, Library-Update; Android Smoke mit mehreren lokalen Titeln. | Vor Upgrade Testabdeckung erweitern. |
| Play/Pause/Skip/Seek | `play`, `pause`, `skipToNext`, `skipToPrevious`, `seekTo`, `seekBy` in `contexts/playbackControlHelpers.ts`, `services/PlaybackService.ts` | Mittel bis hoch | V5 Methoden sind synchron; Fehler-/Locking-Semantik und Previous-Verhalten können abweichen. | Unit-Tests + manueller Foreground/Background-Smoke. | API-Mapping explizit dokumentieren. |
| Repeat/Shuffle | `setRepeatMode`, V4 `RepeatMode.Track/Queue`, Shuffle-Queue-Rebuild | Mittel bis hoch | V5 RepeatMode-Werte ändern; Shuffle wird lokal über Queue-Rebuild gesteuert. | Repeat off/all/one und Shuffle togglen mit laufender Wiedergabe. | Mapping in isoliertem PR/Spike prüfen. |
| Playback State Events | `usePlaybackState`, `State.Playing/Buffering/Loading`, ActiveTrackChanged | Hoch | Event-/State-Namen und Payloads können sich ändern; UI und Persistenz hängen daran. | Hook-/Event-Tests plus App-UI-Smoke. | Tests zuerst erweitern. |
| Progress Tracking | `useProgress(500)`, `getProgress` | Mittel | V5 `getProgress` ist synchron; Update-Intervalle und Hook-Refresh prüfen. | ProgressBar, Seek, Previous-Restart bei >3s. | Nach Migration mit realer Wiedergabe testen. |
| Notification Controls | `notificationCapabilities`, `compactCapabilities`, `PlaybackService` | Hoch | Android Notification-Aktionen sind user-facing und abhängig von Service/MediaSession/App-Kill-Verhalten. | Notification sichtbar, Buttons funktionieren, Tap öffnet App. | Kein Release ohne Android-Smoke. |
| Lockscreen Controls | V4 `Capability`, Remote Events | Hoch | Lockscreen/MediaSession kann nur realistisch auf Gerät geprüft werden; V5 native Handling kann JS-Service umgehen. | Lockscreen Play/Pause/Next/Previous/Seek. | Echter Geräte-Smoke verpflichtend. |
| Background Playback | `AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification`, Playback Service | Hoch | Background/UI-Unmount und Headless-Service-Verhalten sind native Pfade; NewArch kann Timing ändern. | Hintergrund, Screen-Off, App-Wechsel, Audio läuft/stoppt gemäß Erwartung. | Nicht nur Unit-Tests vertrauen. |
| App-Kill/Restart | `appKilledPlaybackBehavior`, Hydration und persisted current song | Hoch | V5 Changelog nennt `android.taskRemovedBehavior`; Semantik muss zu App-Policy passen. | Swipe away, Neustart, Notification entfernt/Queue-Zustand geprüft. | App-Kill-Policy neu spezifizieren. |
| Audio Focus | `autoHandleInterruptions`, V5 `audioMixing` ab 5.5.0 | Mittel bis hoch | Audio-Focus-Verhalten beeinflusst Telefonate/andere Apps; V5 5.5.0 ergänzt Mixing. | Andere Audio-App, Anruf/Unterbrechung, Resume/Pause-Verhalten. | Vor Release manuell testen. |
| Current Track / Active Track | `getActiveTrack`, `Event.PlaybackActiveTrackChanged`, `useCurrentSongSync.ts` | Hoch | V5 nutzt Active Media Item-Konzept; Persistenz/CurrentSong kann falsch werden. | Trackwechsel, Queue-Skip, App-Restart, fehlende ID. | Event-/Hook-Mapping früh klären. |
| Track Metadata / Artwork | `toTrackPlayerTrack`, `updateMetadataForTrack`, Artwork URI | Hoch | V5 MediaItem-Felder unterscheiden sich; Notification/Lockscreen-Artwork ist kritisch sichtbar. | Lokale Cover, fehlende Cover, Metadata-Update nach Tag-Edit. | Separate Metadata-Smoke-Checkliste. |
| Error Handling | Setup-/Playback-/Queue-Fehlerlogs in mehreren Dateien | Mittel | Synchrone V5-Calls und native Fehler können andere Exception-/Return-Semantik haben. | Fehlerpfade im Mock, ungültige URLs, leere Queue, Native-Setup-Fehler. | Mock und Fehlerkonventionen vor Migration definieren. |

## Empfehlung

### Kurzentscheidung

- **Jetzt nicht upgraden.** A1 bestätigt keine sichere, kleine Änderung: V4 bleibt für den aktuellen Zustand stabiler, V5 ist NewArch-pflichtig, neues Paket, Rewrite, API-breaking und lizenzrelevant.
- **Vorerst auf `react-native-track-player@4.1.2` bleiben** und `newArchEnabled=false` beibehalten.
- **Vor einem Upgrade zuerst TrackPlayer-Nutzung und Tests kartieren/erweitern.** Diese A1-Datei ist die erste Kartierung, ersetzt aber keinen Android-Smoke.
- **Wenn V5/NewArch relevant wird: separater Spike-Branch**, nicht direkt Produktiv-PR.
- **Vor jedem NewArch-Opt-in: neuer Android Dev-Build und echter Android-Smoke** für Foreground, Background, Notification, Lockscreen/MediaSession, App-Kill/Restart, Audio Focus und Metadata/Artwork.
- **Kein main-Handoff mit ungeklärtem Playback-/Notification-/Background-Risiko.**

### Empfohlene PR-Reihenfolge

| Reihenfolge | PR / Schritt | Inhalt | No-Go |
|---:|---|---|---|
| 1 | A1 (dieser PR) | Dokumentation, offizielle Quellen, Code-Mapping, Risiko-Matrix. | Keine Dependency-/Code-/NewArch-Änderung. |
| 2 | A2 Entscheidung/Testabdeckung | Zusätzliche Unit-/Integrationstests für aktuelle V4-Nutzung, besonders Queue, Remote Events, Hydration, Current Track und Metadata. | Kein V5-Upgrade ohne Entscheidung. |
| 3 | V5-Lizenz-/Spike-Entscheidung | Lizenzmodell/Procurement klären; Spike-Branch mit `@rntp/player`, NewArch und API-Mapping. | Nicht in Produktivbranch mergen ohne Smoke. |
| 4 | Android Dev-Build Smoke | Neuer Dev-Build, echte Geräte-Smokes für Playback/Notification/Lockscreen/Background. | Kein Release-Claim ohne erfolgreiche Smokes. |
| 5 | Expo/RN/SDK-Gesamtupgrade | Erst nach stabilem TrackPlayer-/NewArch-Pfad; SDK 55+ relevant, weil Legacy nicht mehr deaktivierbar ist. | Kein SDK-55+-Upgrade mit ungeklärtem TrackPlayer-Pfad. |
