# F06 – reale Android-Geräte: tatsächliche Nachweislücke

Stand 16.10.2026. Ergebnis: **extern blockiert**, kein bestätigter neuer Produktfehler.

In der aktuellen Arbeitsumgebung ist kein `adb` installiert, kein USB-Gerätebus eingebunden und kein physisches Android-Gerät angeschlossen. Die angebotenen Limrun-Geräte sind Simulatoren/Emulatoren. Es gibt daher keinen zulässigen Weg, Herstellergeräte, deren SAF-Provider, physische Headsets/Bluetooth oder eine echte TalkBack-Bedienung als bestanden auszugeben. Ein weiterer identischer Emulatorlauf würde diese Lücke nicht schließen und wird hierfür nicht gestartet.

Die bestehenden V5-Emulatornachweise bleiben gültig für ihre exakte APK; sie werden weder als Samsung-/Huawei-Abnahme noch als Abnahme des neuen V4-Codes bezeichnet. Issues #234 und #236 bleiben offen.

## Konkrete externe Abnahme

Mit der abschließend gebauten neuen, exakt gehashten Preview-APK und ausschließlich synthetischen MP3-/M4A-/FLAC-Dateien:

| Bereich | Noch benötigter physischer Nachweis |
|---|---|
| Samsung | Start, Library, native Wiedergabe, Pause/Resume, Queue, Neustart-Persistenz, Dark/Light/Skins und 200-%-Bedienung |
| Huawei | Derselbe Smoke oder explizite, dokumentierte Herstellergeräte-Verfügbarkeit/Owner-Risikoentscheidung |
| SAF-Provider | OEM-/SD-/Cloud-Provider: Grant-Verlust, Read-only, unerreichbare Quelle, Readback, Abbruch/Neustart-Recovery und kein unbestätigter Write |
| Audio-Routen | Kabel-Headset und Bluetooth: Unterbrechung, Audiofokus, Mediensteuerung, Background/Lockscreen |
| TalkBack | Sinnvolle Fokusreihenfolge und Labels; alle wesentlichen Aktionen erreichbar, auch bei 200 % |

Pro Fall sind APK-SHA, Gerät/Android/Provider, reproduzierbare Schritte, Soll/Ist, relevante Logs und Screenshots festzuhalten. Fehler werden zuerst nachgewiesen und gezielt korrigiert. Ohne diese Belege bleibt F06 extern blockiert; weder ein Main-Merge noch ein öffentlicher Produktionsrelease ist damit freigegeben.
