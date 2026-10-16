# Retest einer expliziten, bereits gebauten APK

Der historische `android-release-retest.yml` bleibt als V5-Nachweis unverändert. Der neue Workflow `android-manifest-retest.yml` akzeptiert ein vollständiges Manifest per `workflow_dispatch` oder als Änderung ausschließlich an `docs/review/apk-retest-request.json` auf `codex`. Er baut keine APK und wählt niemals automatisch „latest“.

```json
{
  "version": 1,
  "repository": "k1w1-a0style/musik-player",
  "sourceCommit": "EXAKTE_40_STELLIGE_SOURCE_SHA",
  "runId": 123,
  "artifactId": 456,
  "artifactDigest": "sha256:EXAKTER_64_STELLIGER_ZIP_DIGEST",
  "apkSha256": "EXAKTER_64_STELLIGER_APK_HASH"
}
```

Die Platzhalter sind absichtlich ungültig und müssen anhand des tatsächlichen Quell-CI-Laufs und dessen APK-Artefakts ersetzt werden. Der GitHub-Artefakt-Digest bezeichnet die ZIP-Datei, nicht die APK. Ein Manifest ist keine Freigabe: Der Prüfer bindet alle Werte an GitHub-Metadaten, erfolgreiche unabhängige Security-/Quality-/Native-Gates und unveränderte produktive Quellen. Abgelaufene Artefakte, doppelte/fehlende/rote Gates, Fremd-Repositories, andere Runs, falsche Hashes, zusätzliche ZIP-Mitglieder und produktive Änderungen werden abgewiesen.

Erst nach Prüfung von heruntergeladenem ZIP-Digest, eingebetteter Source und APK-Hash beginnt die isolierte Emulator-Abnahme. Der GitHub-Token wird nicht an die signierte Download-URL weitergegeben. Keine Wiederverwendung alter Matrixfälle. Retest-Manifest und sämtliche neuen Beweise werden gemeinsam hochgeladen. Ein unabhängiger grüner Retest kann einen Infrastrukturfehler im Gerätejob erklären, ersetzt aber nicht den gesonderten formalen Gesamt-CI-Handoff.

Start ohne Default-Branch-Änderung: das konkrete JSON als `docs/review/apk-retest-request.json` committen und ausschließlich diese Datei auf `codex` veröffentlichen. Kein `[skip ci]` im Anforderungscommit. Der eigene Retest startet nur für diesen Pfad; die normale CI ignoriert ausschließlich diesen Anforderungspfad. Sobald irgendeine andere Datei mit geändert wird, greift dieser Pfad-Ausschluss nicht. Die produktive Source-Gleichheit wird trotzdem vor jedem Gerätestart erneut streng geprüft.

Alternativ über GitHub Actions „Retest explicit inspected APK“, Branch `codex`, Eingabe `manifest` als ein JSON-Objekt, sobald GitHub den Dispatch bereitstellt. Am 16.10. war der reine neue Dispatch auf `codex` noch nicht registriert (öffentliche API: 404); der Pfad-Trigger beseitigt diese Abhängigkeit, ohne `main` anzufassen. Eine reine Treiberkorrektur kann zuerst mit `[skip ci]` gesichert werden, danach löst ein separater konkreter Anforderungscommit den Retest aus. Der vorhandene integrierte CI-Gerätejob bleibt für die erste Abnahme neuer produktiver Quellen maßgeblich.
