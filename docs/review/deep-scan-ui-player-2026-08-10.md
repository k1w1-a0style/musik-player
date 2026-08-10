# Projektweiter Deep Scan und Player-Überarbeitung — 2026-08-10

## Auftrag und Ausgangspunkt

Geprüft wurde der vollständige Stand des Branches `codex` ab
`f870ecac603ac8e7b497a7c7871879ee0ff74e97`. Der Review umfasste Logik,
Laufzeitverhalten, SoundCloud- und Classic-Player, Bibliothek, Playlists,
Nebenseiten, Accessibility, Theme-Konformität, Abhängigkeiten, Android-Konfiguration
und Release-Gates. Die SoundCloud-Ansicht wurde zusätzlich gegen die bereitgestellte
APK-Oberflächenanalyse abgeglichen.

## Ergebnis

Alle im Quellcode reproduzierbaren High- und Medium-Befunde dieses Durchlaufs wurden
behoben. Es bleiben zwei externe Release-Gates offen: die native Android-/Geräteprüfung
und der bereits verfolgte `image-size`-Upstream-Fund. Es wurde weder ein unsicherer
Zwangs-Downgrade noch `npm audit fix --force` eingesetzt.

## Umgesetzte Befunde

| Bereich | Befund | Korrektur | Status |
| --- | --- | --- | --- |
| Queue-Logik | „Weiter“ konnte am Queue-Ende im Mini-Player aktiv bleiben | Gemeinsame Queue-Guard-Logik einschließlich Repeat-Modus verwendet | Behoben |
| Suche | Beim Schließen blieb ein unsichtbarer Filter aktiv | Suchtext wird beim Schließen zuverlässig geleert | Behoben |
| Queue | Lange Queue öffnete immer am Anfang | Aktueller Titel wird als initialer Listenindex verwendet | Behoben |
| Android Back | Zurück schloss den Player trotz geöffneter SoundCloud-Queue | Queue fängt Hardware-Back zuerst ab und schließt animiert | Behoben |
| Teilen | Fehler des Plattform-Share-Sheets blieben unsichtbar | Verständlicher Fehlerdialog ergänzt | Behoben |
| Font-Start | Ein Font-Ladefehler konnte den Startbildschirm dauerhaft halten | System-Fallback wird nach protokolliertem Fehler freigegeben | Behoben |
| Classic-Performance | Der komplette Player renderte mit jedem 500-ms-Progress-Tick neu | Progress-Verbrauch in eine kleine memo-isierte Waveform-Unterkomponente isoliert | Behoben |
| Classic-Struktur | Mehrere ungenutzte Props und doppelte Layoutwerte | Props entfernt, Komponenten memo-isiert, redundantes Layoutfeld entfernt | Behoben |
| SoundCloud-Progress | 650-ms-Vorhersage übersprang das 500-ms-Providerintervall sichtbar | Beide Takte auf 500 ms synchronisiert | Behoben |
| SoundCloud-Scrubbing | Zeitstempel aktualisierte sich erst nach Loslassen | Gedrosselte Live-Vorschau während des Ziehens ergänzt | Behoben |
| Gesten | Horizontaler Trackwechsel konnte mit Waveform-Scrubbing konkurrieren | Explizite Gesture-Handler-Arbitration ergänzt | Behoben |
| SoundCloud-Seiten | Nachbarseiten zeichneten gespielte Waveform und Playhead doppelt | Nachbarn zeigen nur eine statische, ungespielte Vorschau | Behoben |
| Queue-Ende | Fehlendes Next-Artwork wurde mit aktuellem Cover kaschiert | Falschen Artwork-Fallback entfernt | Behoben |
| Pause-Optik | Pausenzustand wirkte kaum wie die analysierte SoundCloud-Ansicht | Gedimmtes, weichgezeichnetes Artwork und Transport-Overlay ergänzt | Behoben |
| Collapse | Player lag als opake Modalfläche über der Bibliothek | Transparente Modal-Präsentation und echter Reveal beim Herunterziehen | Behoben |
| Motion Accessibility | Endloser Artwork-Drift ignorierte „Animationen reduzieren“ | Systemeinstellung wird beobachtet; Drift und Übergänge werden deaktiviert | Behoben |
| Screenreader | Unsichtbare Nachbarseiten blieben im Accessibility-Baum | Nicht aktive Carousel-Seiten vollständig ausgeblendet | Behoben |
| Statusleiste | Systemicons konnten über dem dunklen SoundCloud-Player schlecht lesbar sein | Lokaler heller Statusleistenmodus gesetzt | Behoben |
| Sprache | Player mischte „Like“, „Queue“, „Next up“ und „Now Playing“ mit Deutsch | Sichtbare Labels konsistent lokalisiert | Behoben |
| Albumraster | Feste 184-px-Karten skalierten auf Tablets und schmalen Geräten schlecht | Responsives Raster mit 2 bis 5 Spalten und berechneter Kartenbreite | Behoben |
| Bibliothekssuche | Kein direkter Lösch-/Schließzustand | Suchfeld erhält Löschen-Aktion; Topbar zeigt eindeutiges Schließen | Behoben |
| Playlist | „Titel hinzufügen“ renderte alle Kandidaten per `map` in einem großen Block | Durchsuchbares, virtualisiertes Bottom-Sheet mit Titel/Künstler/Album-Filter | Behoben |
| Playlist-Reihenfolge | Textbuttons nahmen viel Platz pro Zeile ein | Kompakte, beschriftete Icon-Aktionen für Hoch/Runter/Löschen | Behoben |
| Nebenseiten | Native und eigene Überschriften erschienen doppelt | TrackInfo, TagEditor, Equalizer und Settings auf einen Header reduziert | Behoben |
| Safe Area | Unterseiten reservierten oben zusätzlich Platz unter dem Native Header | Inhalts-Safe-Area auf die Unterkante begrenzt | Behoben |
| Kontrast | Gedämpfter Text lag in beiden Themes teilweise unter dem Zielkontrast | Theme-Opazitäten erhöht und zentral gehalten | Behoben |
| Mini-Player | Vier Aktionen verdrängten Titel auf schmalen Geräten; kleine Touchflächen | Sekundäraktionen ab 390 px, größere Hit-Slops, dekoratives Cover ausgeblendet | Behoben |
| Fonts | Vier ungenutzte Gewichte wurden durch den Paket-Root mitgebündelt | Nur Regular, SemiBold und Bold direkt importiert | Behoben |
| Abhängigkeiten | `@react-navigation/bottom-tabs` und `expo-device` waren unbenutzte Direktabhängigkeiten | Beide Pakete und transitive Restpakete entfernt | Behoben |
| Testqualität | Ein VirtualizedList-Timer erzeugte eine React-`act`-Warnung | Im übergeordneten Screen-Test durch die separat getestete Queue isoliert | Behoben |
| Komplexität | Sechs berührte Hotspots überschritten ihre bestehenden Budgets | Responsive Grid und Mini-Steuerung extrahiert; keine Ausnahme angehoben | Behoben |
| Native Waveform | Maximal 2.400 komprimierte Pakete vom Dateianfang verzerrten lange Songs | Zeitlich verteilte Stichproben über die volle Dauer plus korrigierter Fallback | Behoben, Android-Kompilierung offen |

## SoundCloud-Abgleich

Die aktuelle Ansicht bildet die zentralen Merkmale der Analyse nun als zusammenhängende
Interaktion ab: vollflächiges Cover, dunkle Kontrastflächen, orange Akzentfarbe,
oben links eingeblendete Metadaten, breite Waveform mit Zeitmarken, Tap-to-Pause,
Pause-Transport, horizontaler Drei-Seiten-Trackwechsel, vertikales Einklappen und eine
eigene dunkle Queue. Wichtig für die gefühlte Flüssigkeit sind dabei nicht nur kürzere
Animationen, sondern vor allem die Entkopplung des Progress-Takts, native Animated-Werte,
die Gesten-Priorität und das Vermeiden doppelter Waveform-Layer.

Eine abschließende Pixel-/Bewegungsabnahme bleibt auf einem echten Samsung-Gerät nötig,
weil Schrift-Rasterung, Status-/Navigationsleisten, Decoderverhalten und 60/120-Hz-Frame-
Timing im Jest-/Metro-Umfeld nicht realistisch messbar sind.

## Verifikation

| Gate | Ergebnis |
| --- | --- |
| TypeScript | bestanden |
| ESLint (`--max-warnings=0`) | bestanden |
| Komplexität | 2.595 Produktionsfunktionen bestanden |
| Vollständige Jest-Coverage | 301 Suites / 2.906 Tests bestanden |
| Coverage | 94,50 % Lines / 94,25 % Functions / 83,34 % Branches |
| Source-NUL-Gate | 747 Textquellen bestanden |
| Android-Manifest/Permissions | bestanden; nur erwartete Audio-/Storage-/Service-Rechte |
| Expo Dependency Check | alle Versionen passend |
| Reproduzierbares `npm ci` | bestanden; RNTP-4.1.2-Patch angewendet |
| Android Metro/Hermes Export | bestanden; 3 Font-Assets, 6,16-MB-HBC, 6,3-MB-Export |
| Audit-Policy | bestanden; 0 Critical, 1 freigegebener High-Root, 9 kollabierte Effekte |
| `newArchEnabled` | unverändert `false` |

## Offene Release-Gates

1. **Android/Kotlin und echte Geräte:** Der lokale Gradle-Lauf konnte die Distribution
   wegen des in dieser Umgebung gesperrten Zugriffs auf `services.gradle.org` nicht laden.
   Eine frische Development-APK muss deshalb über die bestehende CI/EAS-Strecke gebaut
   und gemäß Issue #234 auf Samsung geprüft werden. Besonders zu testen sind Waveform,
   Scrubbing, horizontale/vertikale Gesten, Queue-Back, Hintergrundwiedergabe, Neustart-
   Persistenz und Hell-/Dunkelkontrast. Huawei bleibt Test oder dokumentiertes Restrisiko.
2. **Supply Chain:** `image-size@1.2.1` bleibt ausschließlich über Expo/Metro im Build-
   Tooling betroffen. Stand 2026-08-10 ist selbst die veröffentlichte Version 2.0.2 laut
   beiden Advisories betroffen. Die eng gebundene Ausnahme in Issue #378 läuft am
   2026-08-15 ab und darf ohne erneute Entscheidung nicht verlängert werden.
3. **Preview/Production:** In diesem Durchlauf wurden weder Preview noch Production
   ausgelöst. Diese Schritte bleiben eine separate Release-Freigabe.

## Empfohlene Reihenfolge ab GitHub

1. Branch-CI für den neuen `codex`-Commit vollständig abwarten.
2. Development-APK exakt aus dieser SHA bauen und Artefakt-SHA dokumentieren.
3. Samsung-Smoke und Theme-/Restart-Smoke aus #234/#236 durchführen.
4. Den `image-size`-Stand spätestens am 2026-08-15 neu bewerten.
5. Erst nach grünen Geräte-Smokes Preview und danach Production separat freigeben.
