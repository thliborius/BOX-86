# BOX//86

Sokoban in Schwarz, Cyan, Magenta und Weiß: 100 neue, kompakte Räume, eigene Canvas-Pixelgrafik und lokaler Fortschritt. Keine externen Assets, Laufzeitdienste oder Generierung im Browser.

## Start

Node.js 20.19+ oder 22.12+ vorausgesetzt.

```sh
npm install
npm run dev
```

Die angezeigte lokale Adresse öffnen. `npm run build` erstellt die statisch hostbare Webseite in `dist/`. Bei Hosting unter einem Unterpfad Vites `base` entsprechend setzen.

## Bedienung

Schicht beginnen oder einen Raum auswählen. Die Levelauswahl zeigt zehn Räume pro Gruppe; Pfeilbuttons und Gruppenauswahl erschließen alle 100 Räume, ohne Freischaltung.

- Pfeiltasten / WASD: Figur bewegen; Bildschirm-Pfeile ermöglichen Touch-Bedienung.
- Kisten einzeln schieben und alle Ziele belegen. Kisten auf Zielen werden cyan und zeigen ein Häkchen.
- Z / Zurück: unbegrenzt Schritte innerhalb des aktuellen Versuchs zurücknehmen.
- R / Neustart: Raum und Zähler zurücksetzen, Undo-Verlauf löschen.
- Nach Erfolg führt „Weiter“ zum nächsten Raum. Der Abschluss bleibt bis dahin sichtbar.
- Bestwerte für Züge und Schübe sind **getrennte Minima** und können aus verschiedenen Versuchen stammen. Sie erscheinen beim gewählten Raum und im Tooltip seiner Kachel.
- CRT-Scanlines lassen sich im Seitenfuß einschalten.

## Neue Sammlung und Fortschritt

Die alten zehn Testlevels sind vollständig ersetzt. `warehouse-100-v1` enthält stabile IDs `"1"` bis `"100"`. Die ersten 15 Räume sind gezielt gestaltet, die weiteren 85 aus 340 unabhängig geprüften Kandidaten ausgewählt. Kein fremdes Levelpaket wurde verwendet.

| Räume | Einordnung | Schuboptimum |
| --- | --- | --- |
| 1–5 | Sehr einfach | 3–5 |
| 6–15 | Einfach | 5–9 |
| 16–30 | Leicht bis mittel | 8–12 |
| 31–60 | Mittel | 8–14 |
| 61–85 | Mittel bis knifflig | 10–15 |
| 86–100 | Anspruchsvoller | 12–21 |

Unter `box86.progress` speichert localStorage Schema 2 mit `levelPackId`, `lastLevel`, `completed` und allgemeinen `settings`. Ein Abschluss enthält `bestMoves` und `bestPushes`. Schlechtere Ergebnisse überschreiben keine Minima. Laufende Versuche werden nicht gespeichert.

Beim Wechsel vom alten Schema/Paket werden ausschließlich levelbezogene Ergebnisse zurückgesetzt. Allgemeine primitive Einstellungen bleiben erhalten, andere localStorage-Schlüssel werden nicht angefasst. Die Migration wird beim Start dauerhaft gespeichert. Fehlerhafte Einträge werden verworfen; blockierter Speicher verhindert das Spielen nicht. Beim späteren Austausch der Rätsel die Paketkennung ändern; IDs innerhalb eines veröffentlichten Pakets nicht neu zuordnen.

## Architektur und Levelformat

`src/game.ts` enthält unverändert Parser und Spielregeln, `levels.json` die statischen Daten, `storage.ts` die Persistenz, `render.ts` die Pixelgrafik und `main.ts` die Bedienung. Entwicklungswerkzeuge liegen getrennt unter `tools/levels/`.

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

Genau ein Spieler und gleich viele Kisten wie Ziele sind erforderlich. Das Paket unterstützt 5×5 bis 12×12 Felder und bis zu fünf Kisten; die aktuelle Sammlung bleibt bei maximal 10×9.

## Prüfung und Entwicklungswerkzeuge

```sh
npm run typecheck
npm test
npm run levels:validate
npm run build
```

Die Validierung löst alle 100 Räume neu, ermittelt minimale Schübe und spielt jede Lösung mit der echten Spielengine nach. Formatfehler, unlösbare Räume und Suchlimits führen zu Exitcode 1. [data/level-quality.json](data/level-quality.json) enthält Lösungen, Metriken und die Gesamtauswertung. Bewegungszahlen gehören zur gefundenen schuboptimalen Lösung; sie sind **nicht** als bewegungsoptimal nachgewiesen.

```sh
# Exakt die veröffentlichte Sammlung aus den fixierten Designnamen/Seeds reproduzieren:
npm run levels:generate
npm run levels:validate

# Neue Kandidaten suchen; dauert länger und ändert die Sammlung noch nicht:
npm run levels:search
# Redaktionelle Neuauswahl aus tmp/level-candidates.json (bewusster Paketwechsel):
npm run levels:generate -- --select
```

[docs/levels.md](docs/levels.md) erklärt Solver, Generator, Auswahl, Bewertung und ihre Grenzen. [data/level-selection.json](data/level-selection.json) hält die Auswahl reproduzierbar fest. Der Produktions-Build enthält weder Solver noch Bericht oder Generator.

Browserprüfung für Ticket 2: Migration mit erhaltenen Scanlines, Auswahl/Neuladen von Raum 100, Abschluss von Raum 1 anhand der Solver-Lösung, Bestwerte, Undo, Neustart und Darstellung kleiner/großer Räume auf Desktop und Smartphone.

Die Pixelgrafik orientiert sich an 320×200 und skaliert die 16×16-Sprites ausschließlich um ganze Faktoren, ohne Kantenglättung. Sehr schmale Fenster verwenden eine kleinere Vergrößerung. Die eigene lokale Schrift liegt unter `src/assets/box86-pixel.ttf`; `scripts/build-font.py` kann sie optional mit Python/`fonttools` neu erzeugen. Das Werkzeug ist für Installation, Spiel und Build nicht erforderlich.
