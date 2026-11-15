import { readFileSync, writeFileSync } from "node:fs";
import { parse, type Level } from "../../src/game";
import { candidate } from "./generator";
import { tutorials } from "./tutorial";
import { solve } from "./solver";
import { analyze, type Solved } from "./quality";
import { canonical, geometrySimilarity } from "./duplicates";
import { verify } from "./verify";

type Selection =
  | { kind: "handcrafted"; name: string }
  | { kind: "generated"; name: string; seed: number; boxes: number };
type Candidate = {
  seed: number;
  boxes: number;
  map: string;
  archetype: string;
  result: Solved;
  quality: ReturnType<typeof analyze>;
};
const names = [
  "Schmale Gasse",
  "Nebenraum",
  "Lagerwinkel",
  "Doppelbogen",
  "Erster Umweg",
  "Am Pfeiler",
  "Zwischen den Toren",
  "Linke Bucht",
  "Kleine Kreuzung",
  "Über Eck",
  "Im Seitenflügel",
  "Torfahrt",
  "Hinterhof",
  "Auf dem Absatz",
  "Letzter Stellplatz",
  "Kurze Schleife",
  "Alte Werkstatt",
  "Laderampe",
  "Im Quergang",
  "Kistenkarussell",
  "Verbindungsweg",
  "Dritte Tür",
  "Der Innenhof",
  "Rangierpause",
  "An der Mauer",
  "Zwei Zugänge",
  "Abstellnische",
  "Freie Bahn",
  "Umladestation",
  "Langes Wochenende",
  "Später Eingang",
  "Säulengang",
  "Frachtwechsel",
  "Platz zum Wenden",
  "Gleiswechsel",
  "Lagerschleife",
  "Kreuzverkehr",
  "Nordflügel",
  "Südbucht",
  "Zwischenstopp",
  "Um die Insel",
  "Das Scharnier",
  "Enge Kurve",
  "Warteschlange",
  "Hofdienst",
  "Offene Hintertür",
  "Auf Umwegen",
  "Der Knoten",
  "Lückenfüller",
  "Versandbereit",
  "Gegenrichtung",
  "Schlüsselstelle",
  "Schichtwechsel",
  "Blockade lösen",
  "Rückwärtiges Tor",
  "Alte Schlosserei",
  "Zwischen zwei Wänden",
  "Doppelter Umlauf",
  "Die Zwischenablage",
  "Hinter dem Pfeiler",
  "Zentrale Ablage",
  "Vor der Ausfahrt",
  "Verpackungsraum",
  "Drei Zufahrten",
  "Der Wendepunkt",
  "Untere Etage",
  "Große Sortierung",
  "Die letzte Nische",
  "Im Gegenbogen",
  "Sorgfältig stapeln",
  "Späte Lieferung",
  "Letzte Runde",
  "Zwischen den Reihen",
  "Tor nach Westen",
  "Kleine Meisterprobe",
  "Kistenwechsel",
  "Die Schaltstelle",
  "Am Engpass",
  "Freie Hinterhand",
  "Schlusslieferung",
  "Vor dem Feierabend",
  "Letzte Durchfahrt",
  "Auslagerung",
  "Nachtschicht",
  "Alles verstaut",
];

if (process.argv.includes("--select")) {
  const pool = JSON.parse(
    readFileSync("tmp/level-candidates.json", "utf8"),
  ) as Candidate[];
  const scoredTutorials = tutorials.map((t) => {
    const r = solve(parse(t.map));
    if (r.status !== "solved") throw Error(t.name);
    return { ...t, score: analyze(t.map, r).score };
  });
  const introduction = new Set([
    "Um die Säule",
    "Die kleine Kurve",
    "Hinter der Ecke",
    "Nicht an die Wand",
    "Kleine Ausweichspur",
  ]);
  const orderedTutorials = [
    ...scoredTutorials
      .filter((t) => introduction.has(t.name))
      .sort((a, b) => a.score - b.score),
    ...scoredTutorials
      .filter((t) => !introduction.has(t.name))
      .sort((a, b) => a.score - b.score),
  ];
  const selectedMaps = orderedTutorials.map((t) => t.map),
    used = new Set<number>();
  const selection: Selection[] = orderedTutorials.map((t) => ({
    kind: "handcrafted",
    name: t.name,
  }));
  // Score windows overlap to allow geometry/strategy variety without sharp difficulty jumps.
  const groups = [
    { count: 15, lo: 33, hi: 49, minBoxes: 2, maxBoxes: 3, minPushes: 8 },
    { count: 10, lo: 43, hi: 59, minBoxes: 2, maxBoxes: 4, minPushes: 8 },
    { count: 20, lo: 48, hi: 68, minBoxes: 3, maxBoxes: 5, minPushes: 9 },
    { count: 25, lo: 55, hi: 79, minBoxes: 3, maxBoxes: 5, minPushes: 10 },
    { count: 15, lo: 66, hi: 100, minBoxes: 3, maxBoxes: 5, minPushes: 12 },
  ];
  const selectedGroups: Candidate[][] = [];
  for (const group of [...groups].reverse()) {
    const chosen: Candidate[] = [],
      types = new Map<string, number>();
    for (let i = 0; i < group.count; i++) {
      const target =
        group.lo + ((group.hi - group.lo) * i) / Math.max(1, group.count - 1);
      const options = pool.filter(
        (p) =>
          !used.has(p.seed) &&
          p.boxes >= group.minBoxes &&
          p.boxes <= group.maxBoxes &&
          p.result.pushes >= group.minPushes &&
          p.quality.detourPushes > 0 &&
          p.quality.score >= group.lo &&
          p.quality.score <= group.hi &&
          !selectedMaps.some(
            (map) =>
              canonical(map, true) === canonical(p.map, true) ||
              geometrySimilarity(map, p.map) > 0.9,
          ),
      );
      options.sort(
        (a, b) =>
          Math.abs(a.quality.score - target) +
            (types.get(a.archetype) ?? 0) * 2 -
            (Math.abs(b.quality.score - target) +
              (types.get(b.archetype) ?? 0) * 2) || a.seed - b.seed,
      );
      const next = options[0];
      if (!next)
        throw Error(
          `Insufficient diverse candidates for group ${group.lo}, slot ${i}`,
        );
      chosen.push(next);
      used.add(next.seed);
      selectedMaps.push(next.map);
      types.set(next.archetype, (types.get(next.archetype) ?? 0) + 1);
    }
    chosen.sort((a, b) => a.quality.score - b.quality.score || a.seed - b.seed);
    selectedGroups.unshift(chosen);
  }
  let nameIndex = 0;
  for (const chosen of selectedGroups)
    for (const c of chosen)
      selection.push({
        kind: "generated",
        name: names[nameIndex++],
        seed: c.seed,
        boxes: c.boxes,
      });
  if (selection.length !== 100 || nameIndex !== 85)
    throw Error("Selection count");
  writeFileSync(
    "data/level-selection.json",
    JSON.stringify(selection, null, 2) + "\n",
  );
}
const selection = JSON.parse(
  readFileSync("data/level-selection.json", "utf8"),
) as Selection[];
const levels: Level[] = selection.map((s, i) => {
  const map =
    s.kind === "handcrafted"
      ? tutorials.find((t) => t.name === s.name)?.map
      : candidate(s.seed, s.boxes)?.map;
  if (!map) throw Error(`Cannot recreate ${s.name}`);
  const r = solve(parse(map));
  if (r.status !== "solved")
    throw Error(`Unverified generated level ${s.name}: ${r.status}`);
  verify(map, r.solution, r.pushes);
  return { id: String(i + 1), name: s.name, map };
});
if (levels.length !== 100) throw Error("Expected 100 levels");
writeFileSync("src/levels.json", JSON.stringify(levels, null, 2) + "\n");
console.log(
  `Rebuilt ${levels.length} frozen levels from authored maps and selected seeds; independently replayed every solution.`,
);
