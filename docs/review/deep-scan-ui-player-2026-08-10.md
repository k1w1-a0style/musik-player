# Projektweiter Deep Scan und Player-Überarbeitung — 2026-08-10

## Auftrag und Ausgangspunkt

Geprüft wurde der vollständige Stand des Arbeitsbranches `fix/final-player-polish` ab
`daee04ea27932d961b56b322a4985a9f4cad03ed`. Der Review umfasste Logik,
Laufzeitverhalten, SoundCloud- und Classic-Player, Bibliothek, Playlists,
Nebenseiten, Accessibility, Theme-Konformität, Abhängigkeiten, Android-Konfiguration
und Release-Gates. Die SoundCloud-Ansicht wurde zusätzlich gegen die beiden am
2026-08-22 bereitgestellten Android-Referenzscreens (Pause/Wiedergabe) abgeglichen.

## Ergebnis

Alle im Quellcode reproduzierbaren High- und Medium-Befunde dieses Durchlaufs und des
Nachtrags vom 2026-08-22 wurden behoben. Als externes Release-Gate bleibt die native
Android-/Geräteprüfung offen. Der `image-size`-Upstream-Fund wird weiter verfolgt, ist aber
durch eine eng begrenzte, aktive Ausnahme plus deaktivierte gefährdete Parserfamilien
abgesichert. Es wurde weder ein unsicherer Zwangs-Downgrade noch `npm audit fix --force`
eingesetzt.

## Umgesetzte Befunde

| Bereich | Befund | Korrektur | Status |
| --- | --- | --- | --- |
| Queue-Logik | „Weiter“ konnte am Queue-Ende im Mini-Player aktiv bleiben | Gemeinsame Queue-Guard-Logik einschließlich Repeat-Modus verwendet | Behoben |
| Suche | Beim Schließen blieb ein unsichtbarer Filter aktiv | Suchtext wird beim Schließen zuverlässig geleert | Behoben |
| Queue | Lange Queue öffnete immer am Anfang | Aktueller Titel wird als initialer Listenindex verwendet | Behoben |
| Android Back | Zurück schloss den Player trotz geöffneter SoundCloud-Queue | Queue fängt Hardware-Back zuerst ab und schließt animiert | Behoben |
| Teilen | Fehler des Plattform-Share-Sheets blieben unsichtbar | Verständlicher Fehlerdialog ergänzt | Behoben |
| Font-Start | Der JavaScript-Font-Gate verzögerte den Provider-/Navigations-Mount | Drei Schriften werden nativ eingebettet; der JS-Gate wurde vollständig entfernt | Behoben |
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
| Playback-Restore | `Ready`/`Buffering` konnte beim Queue-Rebuild fälschlich als laufende Wiedergabe zurückkehren | `playWhenReady` wird als native Wiedergabeabsicht wiederhergestellt | Behoben |
| Queue-Geste | Das Hochwischen öffnete die Warteschlange erst nach Ende der Geste | Gemeinsamer nativer Animated-Wert zeigt eine fingerfolgende Vorschau; Abwärtsgeste und Android-Back schließen sie | Behoben |
| Reihenfolge | Queue und Playlist boten keinen flächigen Long-Press-Drag | Long-Press-Drag auf dem Zeileninhalt ergänzt; Griff bleibt als sofortige Drag-Alternative erhalten | Behoben |
| SoundCloud-Zustände | Pause und Wiedergabe verwendeten nahezu dieselbe Informationsdichte | Pause zeigt Blur plus große Transportsteuerung; Wiedergabe zeigt Waveform, Zeit-Chip und Cover-Schärfe | Behoben |
| Cover-Akzent | Coverabhängige Farben wechselten sichtbar abrupt | Cover darf zuerst erscheinen; Backdrop, Waveform, Pause-Fortschritt, Classic-Steuerung, Lautstärke sowie Mini-Player-Fortschritt und -Rahmen wechseln nach 120 ms über 760 ms weich über | Behoben |
| Track-Infos | Metadaten waren typografisch und räumlich wenig gegliedert | Hero-Bereich, vier semantische Karten, abgestufte Typografie und Mono-Darstellung für technische Langwerte | Behoben |
| SoundCloud-Chrome | Helle APK-Kontexttasten und die iconbasierte untere Aktionsleiste wurden noch nicht korrekt getroffen | Rechte Kontexttasten auf helle Kreisflächen mit dunklen Icons umgestellt; untere Leiste ohne zusätzliche sichtbare Textlabels verdichtet | Behoben |
| Deadcode/Redundanz | Alte Queue-, Theme-, Tag-Dry-Run-, Album-, Waveform-, Storage- und Kompatibilitäts-Exports sowie eine transitive Direktabhängigkeit blieben liegen | Unreferenzierte Produktionspfade entfernt, Testsimulationen aus dem Runtime-Bundle verschoben, Zeitformatierung konsolidiert und `expo-asset` als unnötige Direktabhängigkeit gestrichen | Behoben |

## SoundCloud-Abgleich

Die aktuelle Ansicht bildet die zentralen Merkmale der bereitgestellten SoundCloud-
Referenz nun als zusammenhängende Interaktion ab: gerahmte Cover-Karte, dunkle
Kontrastflächen, oben links eingeblendete Metadaten, rechte runde Kontextaktionen und eine
untere iconbasierte Aktionsleiste. Die rechten Kontextaktionen verwenden wie in den
Referenzscreens helle Kreisflächen mit dunklen Icons. Während der Wiedergabe liegen Waveform, Playhead und zentrierter
Zeit-Chip über dem scharfen Cover; im Pausenzustand treten Blur und große
Zurück/Play/Weiter-Steuerung an ihre Stelle. Hinzu kommen horizontaler Drei-Seiten-
Trackwechsel, fingerfolgendes Hochwischen zur Queue sowie weich verzögerte,
coverabhängige Akzentwechsel. Wichtig für die gefühlte Flüssigkeit sind die Entkopplung
des Progress-Takts, native Animated-Werte, die Gesten-Priorität und das Vermeiden
doppelter Waveform-Layer.

Eine abschließende Pixel-/Bewegungsabnahme bleibt auf einem echten Samsung-Gerät nötig,
weil Schrift-Rasterung, Status-/Navigationsleisten, Decoderverhalten und 60/120-Hz-Frame-
Timing im Jest-/Metro-Umfeld nicht realistisch messbar sind.

## Verifikation

| Gate | Ergebnis |
| --- | --- |
| TypeScript | bestanden |
| ESLint (`--max-warnings=0`) | bestanden |
| Komplexität | 2.729 Produktionsfunktionen bestanden |
| Vollständige Jest-Coverage | 311 Suites / 2.998 Tests bestanden |
| Coverage | 95,34 % Lines / 94,97 % Functions / 84,30 % Branches |
| Source-NUL-Gate | 774 Textquellen bestanden |
| Android-Manifest/Permissions | bestanden; nur erwartete Audio-/Storage-/Service-Rechte |
| Expo Dependency Check | alle Versionen passend |
| Reproduzierbares `npm ci` | bestanden; RNTP-4.1.2-Patch angewendet |
| Android Metro/Hermes Export | kalter Export bestanden; 3.213 Module, 17 Metro-Assets, 6,19-MB-HBC |
| Audit-Policy | bestanden; 0 Critical, 1 freigegebener High-Root, 42 kollabierte transitive Effekte |
| `newArchEnabled` | unverändert `false` |

## Offene Release-Gates

1. **Android/Kotlin und echte Geräte:** Der lokale Gradle-Lauf konnte die Distribution
   wegen des in dieser Umgebung gesperrten Zugriffs auf `services.gradle.org` nicht laden.
   Eine frische Development-APK muss deshalb über die bestehende CI/EAS-Strecke gebaut
   und gemäß Issue #234 auf Samsung geprüft werden. Besonders zu testen sind Waveform,
   Scrubbing, horizontale/vertikale Gesten, Queue-Back, Hintergrundwiedergabe, Neustart-
   Persistenz und Hell-/Dunkelkontrast. Huawei bleibt Test oder dokumentiertes Restrisiko.
2. **Supply Chain (verfolgt, aktuell nicht abgelaufen):** `image-size@1.2.1` bleibt im
   Expo/Metro-Build-Tooling betroffen. Die gefährdeten ICNS-, JXL-/JXL-Stream- und
   HEIF-Parser sind in Metro fail-closed deaktiviert. Die am 2026-08-22 erneut geprüfte,
   exakt auf Version und beide Advisories begrenzte Ausnahme läuft am 2026-11-20 ab;
   Issue #378 muss spätestens dann erneut bewertet oder durch ein Upstream-Update
   geschlossen werden.
3. **Preview/Production:** In diesem Durchlauf wurden weder Preview noch Production
   ausgelöst. Diese Schritte bleiben eine separate Release-Freigabe.

## Empfohlene Reihenfolge ab GitHub

1. Branch-CI für den neuen `codex`-Commit vollständig abwarten.
2. Development-APK exakt aus dieser SHA bauen und Artefakt-SHA dokumentieren.
3. Samsung-Smoke und Theme-/Restart-Smoke aus #234/#236 durchführen.
4. Den `image-size`-Stand spätestens am 2026-11-20 neu bewerten.
5. Erst nach grünen Geräte-Smokes Preview und danach Production separat freigeben.
