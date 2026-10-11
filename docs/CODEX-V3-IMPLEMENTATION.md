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

**Lokal bestätigt unter Node 24.19.0:** 374 Jest-Suiten / 3.718 Tests bestanden; Coverage 93,48 % Statements / 85,47 % Branches / 95,22 % Functions / 95,94 % Lines, alle konfigurierten Schwellen bestanden. Typecheck, ESLint mit null Warnungen, Komplexität, Source-NUL, Expo-Release-Konfiguration, generiertes Android-Manifest und Android-Hermes-Export samt Dependency-Boundary bestanden. Der Offline-Expo-Dependencycheck meldet kompatible installierte Versionen, weist aber ausdrücklich auf die eingeschränkte Offline-Verlässlichkeit hin. 13 Python-Regressionen der Diagnose-Skripte bestanden.

**Korrektur des Laufzeitnachweises:** Nach der Wiederaufnahme am 11.10.2026 war die zuvor installierte Node-22-Binary nicht mehr vorhanden. Der PATH-Zusatz fiel unbemerkt auf Node 24 zurück. Der oben genannte vollständige Wiederholungslauf ist deshalb ein Node-24-Nachweis; eine frische Wiederholung unter ausdrücklich geprüfter Node 22 ist erforderlich. Der ursprüngliche Baselinelauf vor der Unterbrechung war tatsächlich Node 22.23.3.

**Frische Wiederholung abgeschlossen:** Node 22.23.3 wurde erneut installiert und vor jeder weiteren Ausführung auf Hauptversion 22 geprüft. Unter dieser Laufzeit bestanden erneut alle 374 Suiten / 3.718 Tests des Pakets (die neuen Workflow-Regressionsfälle separat geprüft). Coverage: 93,50 % Statements / 85,48 % Branches / 95,22 % Functions / 95,96 % Lines. Typecheck, Lint, Komplexität, Source-NUL, Manifest- und Bundle-Boundary wurden erneut unter Node 22 bestätigt. Die 20 Node-Tests des EAS-Artefaktresolvers bestanden ebenfalls. Die GitHub-CI zu Commit `1b793d382aaa0365d88c6de3500d00180035a0e5` bestätigt inzwischen die Node-22-Qualitäts- und Securityjobs; der native Job läuft zu diesem Dokumentationsstand noch.

**Nicht bestätigt:** neuer Gradle-/APK-Build, Geräteprüfung, A50-RAM/Frames/CPU/Akku. Die hierfür erforderlichen späteren Prüfungen sind offen.

## Paket 2: Autofix veröffentlicht erst geprüfte Quellen (F23)

Ausgangspunkt: `1b793d382aaa0365d88c6de3500d00180035a0e5`. Keine Datenmigration.

Der manuelle CI-Lite-Autofix führt jetzt erst ESLint-Fixes, danach verbindlichen Lint/Typecheck, vollständige Jest-Coverage, Source-NUL, Komplexität, Expo-Kompatibilität, Manifest-, Bundle- und Release-Configprüfungen aus. Die schwächeren Lint-/Typecheck-Fallbacks entfallen. Ein fehlgeschlagener Fix oder Gate verhindert Writeback; der Writeback prüft die erfolgreichen Ergebnisse zusätzlich selbst.

Staging umfasst ausschließlich tatsächlich geänderte, bereits getrackte JS-/TS-Quelldateien. Vorhandene Staging-Einträge, andere getrackte Änderungen, Löschungen und Umbenennungen werden abgelehnt. Ungetrackte Testlogs und generierte Dateien werden nicht veröffentlicht. Commitfehler oder Pushfehler führen zu Fehlerstatus; ein normaler Fast-Forward-Push erhält die Branchschutzregeln. Kein `git add -A`, kein `[skip ci]`, keine Force-Pushes. Der Token ist nur im Writeback-Schritt verfügbar; Checkout hält keine Credentials vor. Die Ergebnisse werden nach Writeback ergänzt, und die Zusammenfassung verwendet sichere Textformatierung statt versehentlicher Shell-Kommandosubstitution.

**Regression:** Acht korrekte neue Fälle scheiterten auf dem vorherigen Workflow. Nach dem Fix bestehen neun ausführbare Fälle mit temporären Git-Repositories und Tool-Doubles: Reihenfolge, gescheiterter Lint/Typecheck/Coverage/Komplexitätscheck, abgelehnte Gate-Ergebnisse, ausschließlich vorgesehene Quellen im Commit und Ablehnung unerwarteter Dependencyänderungen. Vier Workflowsuiten mit insgesamt 337 Tests bestanden unter Node 22; Typecheck, Lint und Komplexität ebenfalls.

**Grenze:** Die Negativprüfung führt die echten Workflow-Shellblöcke lokal aus; sie erzeugt bewusst keinen absichtlich kaputten Remote-Commit. Eine native Android-Prüfung ist weiterhin Aufgabe der regulären CI und späteren Geräteabnahme.
