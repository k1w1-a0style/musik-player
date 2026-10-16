# Retest einer expliziten, bereits gebauten APK

Der historische `android-release-retest.yml` bleibt als V5-Nachweis unverändert. Der neue Workflow `android-manifest-retest.yml` akzeptiert ausschließlich `workflow_dispatch` auf `codex` mit einem vollständigen Manifest. Er baut keine APK und wählt niemals automatisch „latest“.

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

Start über GitHub Actions „Retest explicit inspected APK“, Branch `codex`, Eingabe `manifest` als ein JSON-Objekt. Falls GitHub den neuen Dispatch-Workflow noch nicht registriert hat, ist das ein Workflow-Verfügbarkeitsblocker; dafür wird weder `main` verändert noch eine neue APK gebaut. Der vorhandene integrierte CI-Gerätejob bleibt für die erste Abnahme neuer produktiver Quellen maßgeblich.
