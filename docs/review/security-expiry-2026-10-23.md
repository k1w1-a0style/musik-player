# Security-Abgleich – 23.10.2026

Übernahme: codex 20278b88f9f9c31fd8f2b8c191ab117666e57f5d; Produktquelle unverändert 63d5a61b.

GitHub hat GHSA-vfj7-8cjw-p6xm am 23.10.2026 zurückgezogen (nicht praktisch ausnutzbar). Der frische npm-Produktionsaudit enthält braces nicht mehr. Seine ungenutzte Ausnahme wird entfernt und der exakt gebundene transitive Effektgraph auf die verbleibenden drei Einträge aktualisiert. Die vorhandene Depth-/Cycle-Härtung bleibt erhalten.

Registry: braces 3.0.3; node-forge 1.4.0. GHSA-86w9-cpqp-85rv weiterhin aktiv, keine gepatchte Veröffentlichung. Der Audit enthält 0 Critical / 4 High / 0 Moderate: node-forge als Wurzel, @expo/code-signing-certificates 0.0.6, @expo/cli 57.0.32 und expo 57.0.31 als Effekte. Expo CLI importiert node-forge auch direkt (iOS Security.js); alleiniger Austausch der Zertifikatsbibliothek entfernt den Pfad nicht. npm nennt als automatischen Fix Expo 44.0.6: ein inkompatibler SDK-Rückschritt, keine belastbare Lösung für Expo 57 / RN 0.86.3.

Der vorhandene hashgebundene DER-Backport bleibt eine zusätzliche Schutzmaßnahme. Er ändert weder npm-Advisory-Status noch Freigaberegel. Die verbleibende node-forge-Ausnahme ist unverändert seit 21.10.2026 abgelaufen und muss die Freigabe weiter verweigern. Keine Verlängerung, Versionsmanipulation oder Abschwächung. Issue #396 bleibt offen.

Quellen: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm und https://github.com/advisories/GHSA-86w9-cpqp-85rv; frische npm Registry-/Auditabfragen am 23.10.2026.

Zusätzlicher Registry-Abgleich: `expo@^57.0.31` ausschließlich57.0.31, `@expo/cli@^57.0.32` ausschließlich57.0.32. Neueste Zertifikatsbibliothek0.0.7 verlangt weiterhin `node-forge:^1.4.0`; ein kompatibler Elternwechsel entfernt die Wurzel nicht. CI39976843895 bestätigt0Critical/4High/0Moderate und verweigert ausschließlich die abgelaufene forge-Ausnahme21.10. Quality und Native erfolgreich; keine Gesamtfreigabe. [Aktueller Gesamtbericht](final-status-2026-10-23.md).
