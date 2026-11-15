# Entstehung und Prüfung des Levelpakets

## Inhalt und redaktionelle Auswahl

`warehouse-100-v2` ist eine neue, selbst erstellte Sammlung. Keine Geometrie der alten zehn Testlevels wird als Bestand weitergeführt. Die endgültigen 100 Karten stehen in `src/levels.json`, ohne Zufall oder Suchlogik zur Laufzeit.

15 handgestaltete Räume (1–13, 20 und 24) werden in `tools/levels/tutorial.ts` gezielt als ASCII-Karten gepflegt, mit Notizen zum beabsichtigten Lernschritt. Sie führen über Schubseitenwechsel und Umwege um Säulen zu zwei und drei miteinander zu rangierenden Kisten. Schon die ersten Räume benötigen Richtungswechsel; das fünfte Rätsel hat zwei Kisten. Der Generator ersetzt dieses Einführungsdesign nicht.

Für weitere Räume wurden 8.826 Seeds untersucht: 340 Kandidaten bestanden die Vorauswahl, davon 140 mit nachweislichem Schubumweg. Zwei nicht abgeschlossene Suchläufe wurden verworfen. Die Zusammenfassung steht in `data/generation-summary.json`; die nicht ausgelieferte Kandidatenliste unter `tmp/` lässt sich mit `levels:search` neu erzeugen.

85 Kandidaten wurden nach folgenden Regeln ausgewählt:

- Ab Raum 16 mindestens acht Schübe, drei Richtungswechsel und drei Wechsel der Arbeitsposition in einer schuboptimalen Lösung.
- Alle 85 verlangen mehr Schübe als die minimale Einzelkisten-Ziel-Zuordnung ohne andere Kisten und ohne Spielerzugang. Diese Differenz beträgt mindestens zwei Schübe. Dadurch reicht bloßes unabhängiges Hinschieben nicht aus.
- Bis Raum 30 zwei oder drei Kisten, bis Raum 40 höchstens vier, danach drei bis fünf.
- Überschneidende Schwierigkeitsfenster erlauben Variation; hohe Kandidaten werden zuerst reserviert und innerhalb ihrer Gruppe sortiert.
- Gleichartige Grundrisse, auch gedreht/gespiegelt, und Grundrisse mit mehr als 90 % normalisierter Flächenüberlappung werden nicht gemeinsam ausgewählt.
- Säulen, Buchten, verbundene Räume, versetzte Flügel und Inseln werden bei der Auswahl gemischt. Die Metriken werden durch Sichtprüfung kleiner, mittlerer und später Räume ergänzt.

Der Schwierigkeitsmittelwert steigt über die sechs Gruppen. Einzelne Übergänge können leichter ausfallen; menschliche Schwierigkeit ist nicht streng sortierbar. Die Auswahl ist unter Namen und Seeds fixiert. `levels:generate` reproduziert genau diese Auswahl und überprüft dabei wieder jede Lösung. `--select` ist eine bewusste Neuauswahl, keine Routine für einen normalen Build. Ein veröffentlichtes Rätselpaket nachträglich zu verändern erfordert eine neue Paketkennung.

Die Reihenfolge in Paket v2 verschiebt „Drei Plätze“ auf Position 20 und „Ende der Frühschicht“ auf Position 24. Alle übrigen Räume behalten ihre relative Reihenfolge; Karten und Lösungen bleiben unverändert. Die Positionsregel gilt auch nach einer bewussten Neuauswahl und ist idempotent. Die erhöhte Paketkennung verwirft lokale Testbestwerte, erhält aber Einstellungen wie Ton und Scanlines.

## Deterministischer Generator

Ein Integer-PRNG bestimmt pro Seed den Grundriss, Ziele, Spieler und Rückwärtszüge. Unterschiedliche architektonische Motive werden mit begrenzter Fläche und zufälligen Aussparungen kombiniert. Alle Bodenfelder müssen ohne Kisten zusammenhängen. Zu große, zu kleine und getrennte Grundrisse werden früh verworfen.

Von Kisten auf Zielen aus wird rückwärts gezogen. Der Spieler muss die Position neben der Kiste erreichen und beim Ziehen ein weiteres freies Feld haben. Die Rückwärtssuche bevorzugt noch nicht besuchte Konfigurationen und Kandidaten mit Abstand, Kontakt und Rangierbedarf. Eine solche Konstruktion ist **kein** Validierungszertifikat: Der Vorwärtssolver bekommt ausschließlich die resultierende Karte, keine Rückwärtslösung.

Bei gleichem Seed und gleicher Generatorversion entstehen dieselben Karten. Die Tests vergleichen vollständige Kandidatenfolgen. Die Kandidatensuche hat zusätzlich Ressourcenlimits; auf sehr langsamen Rechnern können andere Kandidaten verworfen werden. Die fixierte Auswahl und die normale Reproduktion hängen davon nicht ab.

## Unabhängiger Vorwärtssolver

`solver.ts` verwendet A* mit Kosten eins pro Kistenschub. Die erreichbare Spielerfläche wird bei jedem Zustand geflutet; der kleinste erreichbare Feldindex bildet zusammen mit sortierten Kistenpositionen den kanonischen Zustand. Der tatsächliche Spielerstand bleibt zur Rekonstruktion erhalten. Unterschiedliche Laufpositionen im selben Bereich benötigen keine separaten Suchzustände.

Ein Schub ist nur erlaubt, wenn der Spieler hinter die Kiste gelangen kann und das nächste Feld frei ist. Die Heuristik ist die minimale injektive Zuordnung aller Kisten zu Zielen anhand statischer Einzelkisten-Schubdistanzen. Sie unterschätzt die tatsächlichen Kosten, da andere Kisten und notwendige Spielerwege unberücksichtigt bleiben. A* mit erneut zugelassenen Verbesserungen liefert beim erfolgreichen Abschluss ein **Schuboptimum**.

Frühe Ausschlüsse:

- Tote Felder, von denen eine einzelne Kiste geometrisch kein Ziel erreichen kann.
- Unbewegliche, vollständig mit Wänden/Kisten gefüllte 2×2-Blöcke mit mindestens einer Kiste außerhalb eines Ziels.
- Unmögliche Zuordnungen von Kisten zu unterschiedlichen Zielen.

Die Suchgrenzen betragen bei der Endvalidierung 150.000 gespeicherte Zustände und acht Sekunden je Raum. Kandidaten werden mit engeren Grenzen geprüft. Ein Limit ergibt ausdrücklich `limit`, niemals `solved`. Die Zustandsgrenze begrenzt auch den Speicherbedarf der Suche; zusätzlich hält der Heap endlich viele, durch die vier Schubrichtungen und höchstens fünf Kisten begrenzte Nachfolger und gegebenenfalls überholte Einträge.

Die Vorgängerkette speichert für jeden Schub den kürzesten Laufweg zur Schubseite sowie den Schub. Diese lokale Laufwegkürzung garantiert kein globales Bewegungsoptimum: Zustandsnormalisierung und Suchkosten optimieren ausschließlich Schübe.

`verify.ts` spielt jeden einzelnen Lösungsschritt mit `Game.step` nach. Blockierte oder unbekannte Schritte, eine falsche Schubzahl oder ein unvollständiger Endzustand sind Fehler. Der Solver selbst verwendet keine Engine-Bewegungsfunktion. Zusätzlich vergleichen Tests seine Schuboptima auf kleinen Karten mit einer getrennten Suche über Engine-Einzelschritte.

## Bewertung und Grenzen

Der Score in `quality.ts` kombiniert:

| Merkmal | Gewicht / Behandlung |
| --- | --- |
| Schübe über Einzelkisten-Untergrenze | 2,5 je zusätzlichem Schub |
| Minimale Schübe | 0,65 je Schub |
| Kistenanzahl | 2,5 je Kiste |
| Wechsel der Schubrichtung | 1,1 je Wechsel |
| Wechsel der bearbeiteten Kiste | 1,3 je Wechsel |
| Wechsel der Arbeitsposition | 0,7, wenn zwischen Schüben gelaufen wird |
| Verlassen eines Zielfelds | 2 je Vorkommen in der gefundenen Lösung |
| Suchaufwand | 1,1 × log₂(untersuchte Zustände + 1) |
| Kritische Durchgangsfelder | 0,45 je Artikulationsfeld, gedeckelt bei acht |
| Anteil statischer Deadlock-Felder | bis zu 3 Punkte |
| Durchschnitt legaler Schubalternativen | 0,4, gedeckelt bei acht Alternativen |

Lange Laufwege ergeben allein keine Schwierigkeitspunkte. Richtungs- und Kistenwechsel stehen stellvertretend für Reihenfolgen und Spielerpositionierung. Alternativen ignorieren offenkundig tote Zielfelder; sie können trotzdem später in Deadlocks führen. Der Deadlock-Anteil erfasst statische Fallen, keine vollständige Aufzählung dynamischer Deadlocks.

Die Pfadmerkmale gelten für **eine** gefundene optimale Lösung. Nicht jeder Kistenwechsel oder Zwischenstopp ist in allen optimalen Lösungen erforderlich. Der Schubumweg gegenüber der Untergrenze ist dagegen unabhängig vom konkret rekonstruierten Pfad. Suchaufwand hängt vom Algorithmus ab. Artikulationsfelder beschreiben Raumgeometrie und müssen nicht sämtlich lösungsrelevant sein. Deshalb ist der Score eine nachvollziehbare Heuristik, kein Beweis menschlicher Schwierigkeit und kein Ersatz für weiteres Spieltest-Feedback.

## Duplikate und Qualitätsbericht

Die Geometrieprüfung entfernt Wandränder und vergleicht sämtliche acht Dreh-/Spiegeltransformationen. Ein zweiter Schlüssel berücksichtigt Ziele, Kisten und Figur. Im finalen Paket sind sogar alle 100 reinen Grundrisse verschieden; bloßes Versetzen der Objekte zählt somit nicht als neuer Raum.

Zusätzlich meldet der Validator hohe Flächenüberlappung sowie kombinierte Ähnlichkeit von Geometrie und Schubmotiven. Motive normalisieren Richtungen und die Reihenfolge der Kistenlabels und vergleichen Folgen per längster gemeinsamer Teilsequenz. Das erkennt verwandte Muster, garantiert aber keine semantische Verschiedenheit aller Rätsel. Ähnliche Motive in deutlich verschiedenen Räumen sind zulässig.

`npm run levels:validate` erzeugt `data/level-quality.json` neu. Pro Raum enthält der Bericht ID, Namen, Abmessungen, Kistenanzahl, minimale Schübe, Bewegungszahl der gefundenen Lösung, Bewertungsmerkmale, untersuchte Zustände, vollständige Lösung und Validierungsstatus. Die Zusammenfassung enthält Gruppenwerte, Umweganzahl, Geometrieanzahl und mögliche Ähnlichkeitspaare. Der Bericht enthält keine zufälligen Zeitstempel und ist reproduzierbar.

Der aktuelle Stand hat 100 validierte Räume, 100 unterschiedliche Grundrisse und keine gemeldeten Geometrie-/Strategieähnlichkeitspaare über den definierten Schwellen. Alle 100 Lösungen wurden unabhängig reproduziert. Allein daraus folgt nicht, dass jede Person dieselbe Schwierigkeit oder denselben Spielspaß empfindet; breit angelegte menschliche Spieltests stehen weiterhin aus.
