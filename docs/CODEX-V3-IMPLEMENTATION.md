# Arbeitsplan V3 – Umsetzungsnachweis

## Paket 1: Quellenintegrität und Albumlogik

Ausgangspunkt: `a1725abb0050bc64cb4b3445624f382658eca8fc`. Stand: 11.10.2026.

**F01/F02:** Gemeinsame Quellenidentität erhält bedeutende Groß-/Kleinschreibung und kodierte Dokumentsegmente. Überlappende SAF-Grants derselben Dokument-ID werden erkannt. Dateiname, Größe und Dauer führen unabhängige Quellen nicht mehr automatisch zusammen. Opaque Provider-Queries und Fragmente bleiben bedeutend; bei `file://` werden reine URI-Cachezusätze entfernt.

**F06:** Expo-Filesystem-Sekunden werden an der Adaptergrenze in Millisekunden umgerechnet. Exakt passende plausible Altwerte in Epoch-Sekunden werden beim nächsten erfolgreichen Quick-Scan migriert, ohne Song-ID oder Audio-Vorbereitungsrevision zu erneuern. Echte Größen-, Hash- und Datumsänderungen bleiben Änderungen.

**F03:** Import/Refresh können bestätigte fehlende Angaben jetzt explizit melden. Vollständig gelesene unterstützte ID3v2-Tags beziehungsweise nachgewiesene MPEG-Audiodaten und ein erfolgreicher begrenzter Tailcheck ermöglichen das Entfernen optionaler Tags. Nicht lesbare, abgeschnittene, transformierte oder unbekannte Metadaten erzeugen keinen Löschbeleg. ID3v1/APE/Lyrics-Tailhinweise verhindern eine voreilige Löschung. Native bestätigte Coverabwesenheit kann alte eingebettete Covers entfernen; ausstehende oder fehlgeschlagene eigene Cover-Vorschauen bleiben geschützt. Prüfbelege werden nicht als dauerhafte Löschanweisungen weitergereicht.

**Grenze F03:** Die automatische Bestätigung fehlender Textfelder für MP4/M4A und nicht unterstützte Tagvarianten ist in diesem Paket noch offen. Solche Angaben bleiben konservativ erhalten. Ein grüner Test der Löschschnittstelle bedeutet keine vollständige Formatabnahme.

**F04/F05:** Albumansicht und daraus erzeugte Queues folgen Disc, Track, Titel und stabiler ID. Fehlende Disc bedeutet Disc 1, fehlende Tracknummer folgt bekannten Tracknummern. Gleichnamige Künstleralben sind getrennt; ein expliziter Albumartist verbindet Compilations. Die Suchansicht verwendet den vollständigen Bestand für begrenzte Albumartist-Inferenz beim selben Trackkünstler, ohne fremde Künstleralben pauschal zu übernehmen.

**Migration:** Bestehende Songreferenzen bleiben beim erkannten Reimport erhalten. Frühere versehentliche Zusammenführungen werden nicht geraten aufgespalten. Neue unabhängige Quellen können beim erneuten Scan getrennt aufgenommen werden.

**Neue Regressionen:** Sieben ursprüngliche Fehlerfälle plus URI-/Encodinggrenzen, sichere Epoch-Migration, native/JS-Tagkombination, Preview-Schutz, begrenzte Head-/Tailprüfung, Tailfehler, File-API-Fallback, Abbruch und stabile Suchgruppen. Alte Tests, die case-folded Dateipfade und schwache Duplikatbeweise verlangten, wurden auf den korrigierten Vertrag umgestellt.

**Lokal bestätigt unter Node 22.23.3:** 374 Jest-Suiten / 3.718 Tests bestanden; Coverage 93,48 % Statements / 85,47 % Branches / 95,22 % Functions / 95,94 % Lines, alle konfigurierten Schwellen bestanden. Typecheck, ESLint mit null Warnungen, Komplexität, Source-NUL, Expo-Release-Konfiguration, generiertes Android-Manifest und Android-Hermes-Export samt Dependency-Boundary bestanden. Der Offline-Expo-Dependencycheck meldet kompatible installierte Versionen, weist aber ausdrücklich auf die eingeschränkte Offline-Verlässlichkeit hin. 13 Python-Regressionen der Diagnose-Skripte bestanden.

**Nicht bestätigt:** neuer Gradle-/APK-Build, Geräteprüfung, A50-RAM/Frames/CPU/Akku. Die hierfür erforderlichen späteren Prüfungen sind offen.
