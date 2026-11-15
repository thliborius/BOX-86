# BOX//86

Ein kleines Sokoban-Spiel in Schwarz, Cyan, Magenta und Weiß. Zehn handgebaute Räume, eigene Canvas-Pixelgrafik und ein lokaler Spielstand. Keine externen Assets oder Laufzeitdienste.

## Start

Node.js 20.19+ oder 22.12+ vorausgesetzt.

```sh
npm install
npm run dev
```

Die angezeigte lokale Adresse öffnen. `npm run build` erstellt die statisch hostbare Webseite in `dist/`. Bei Hosting unter einem Unterpfad Vites `base` entsprechend setzen.

## Bedienung

Schicht beginnen oder direkt einen Raum auswählen. Pfeiltasten / WASD bewegen die Figur; Bildschirm-Pfeile ermöglichen Touch-Bedienung. Kisten lassen sich nur einzeln schieben. Alle Kisten müssen auf den magentafarbenen Zielfeldern stehen; korrekt platzierte Kisten werden cyan.

- Z / Zurück: unbegrenzt Schritte innerhalb des aktuellen Versuchs zurücknehmen.
- R / Neustart: Raum und Zähler zurücksetzen, Undo-Verlauf löschen.
- Nach Erfolg führt „Weiter“ zum nächsten Raum. Der Abschluss bleibt sichtbar, bis du weitergehst.
- Alle zehn Räume sind jederzeit anwählbar.

## Aufbau und Levelformat

`src/game.ts` enthält Parser und zustandsbasierte Regeln, `levels.ts` die Daten, `storage.ts` die Persistenz, `render.ts` die Pixelgrafik und `main.ts` die Bedienung.

Levels sind rechteckige ASCII-Karten mit geschlossenem Wandrand:

| Zeichen | Bedeutung |
| --- | --- |
| `#` | Wand |
| Leerzeichen | Boden |
| `.` | Ziel |
| `@` | Spieler |
| `$` | Kiste |
| `+` | Spieler auf Ziel |
| `*` | Kiste auf Ziel |

Genau ein Spieler und gleich viele Kisten wie Ziele sind erforderlich. IDs wie `box86-001` bleiben beim Umbenennen oder Umsortieren unverändert. Unter `box86.progress` speichert localStorage ein versioniertes Objekt mit `version`, `lastLevel` und einem nach stabilen IDs indizierten `completed`-Objekt. Pro Level bleiben der beste Zugzähler und dessen Schubzähler erhalten. Laufende Versuche werden nicht gespeichert. Beschädigte oder unbekannte Speicherformate fallen auf einen leeren Fortschritt zurück; blockierter Speicher verhindert das Spielen nicht.

## Prüfung

```sh
npm run typecheck
npm test
npm run build
```

14 Tests prüfen Regeln, Undo, Neustart, Parsing und Speicherfehler. Eine Breitensuche durch erreichbare Spielzustände weist die Lösbarkeit aller zehn Räume nach. Die kleinen Einführungsräume steigern Kistenanzahl und Rangierbedarf; eine subjektive Schwierigkeitseinstufung ersetzt das nicht.

Das Canvas verwendet 320×200 Pixel und deaktivierte Kantenglättung. Die Darstellung passt sich dem Fenster an; bei nicht ganzzahligen Skalierungsfaktoren können Pixel unterschiedlich breit erscheinen. Keine Animationen, kein Generator, keine zusätzlichen Spielmodi.
