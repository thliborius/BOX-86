import { pathToFileURL } from "node:url";
import { writeFileSync, readFileSync } from "node:fs";
import { parse, initial, won, type Level } from "../../src/game";
import { LEVEL_PACK_ID } from "../../src/pack";
import { solve, reachable, type Limits } from "./solver";
import { analyze, isInteresting } from "./quality";
import {
  canonical,
  geometrySimilarity,
  strategySimilarity,
} from "./duplicates";
import { verify } from "./verify";
import { tutorials } from "./tutorial";

export function validatePack(levels: Level[], limits?: Limits) {
  const errors: string[] = [],
    seenIds = new Set<string>(),
    layouts = new Map<string, string>(),
    puzzles = new Map<string, string>();
  if (levels.length !== 100)
    errors.push(`Expected exactly 100 levels, got ${levels.length}`);
  const rows = levels.map((l, index) => {
    try {
      if (l.id !== String(index + 1) || seenIds.has(l.id))
        throw Error("IDs must be unique, ordered 1–100");
      seenIds.add(l.id);
      if (!l.name?.trim()) throw Error("Missing name");
      const b = parse(l.map);
      if (
        b.width < 5 ||
        b.height < 5 ||
        b.width > 12 ||
        b.height > 12 ||
        b.boxes.length > 5
      )
        throw Error("Unsupported size or crate count");
      if (reachable(b, b.player, []).cells.size !== b.floors.size)
        throw Error("Disconnected floor");
      if (won(b, initial(b))) throw Error("Already solved");
      const layout = canonical(l.map, true),
        puzzle = canonical(l.map);
      if (layouts.has(layout) || puzzles.has(puzzle))
        throw Error(
          `Duplicate/symmetry of ${layouts.get(layout) ?? puzzles.get(puzzle)}`,
        );
      layouts.set(layout, l.id);
      puzzles.set(puzzle, l.id);
      const result = solve(b, limits);
      if (result.status !== "solved")
        throw Error(`Solver ${result.status} after ${result.states} states`);
      const replay = verify(l.map, result.solution, result.pushes);
      if (
        !isInteresting(
          l.map,
          result,
          tutorials.some((t) => t.map === l.map),
        )
      )
        throw Error("Trivial solution heuristic failed");
      return {
        id: l.id,
        name: l.name,
        width: b.width,
        height: b.height,
        boxes: b.boxes.length,
        minimumPushes: result.pushes,
        pushOptimal: result.optimalPushes,
        solutionMoves: replay.moves,
        moveOptimal: false,
        states: result.states,
        ...analyze(l.map, result),
        solution: result.solution,
        status: "validated" as const,
      };
    } catch (error) {
      const message = `${l.id} (${l.name}): ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      return {
        id: l.id,
        name: l.name,
        status: "failed" as const,
        error: message,
      };
    }
  });
  const nearPairs: { a: string; b: string; overlap: number }[] = [];
  for (let i = 0; i < levels.length; i++)
    for (let j = i + 1; j < levels.length; j++) {
      if (rows[i].status !== "validated" || rows[j].status !== "validated")
        continue;
      const overlap = geometrySimilarity(levels[i].map, levels[j].map);
      if (overlap > 0.9)
        nearPairs.push({
          a: levels[i].id,
          b: levels[j].id,
          overlap: +overlap.toFixed(3),
        });
    }
  const strategyPairs: {
    a: string;
    b: string;
    geometryOverlap: number;
    strategyOverlap: number;
  }[] = [];
  const validRows = rows.filter((r) => r.status === "validated");
  for (let i = 0; i < validRows.length; i++)
    for (let j = i + 1; j < validRows.length; j++) {
      const a = validRows[i],
        b = validRows[j];
      const overlap = geometrySimilarity(
        levels[Number(a.id) - 1].map,
        levels[Number(b.id) - 1].map,
      );
      const strategy = strategySimilarity(a.pushPattern, b.pushPattern);
      if (overlap > 0.8 && strategy > 0.85)
        strategyPairs.push({
          a: a.id,
          b: b.id,
          geometryOverlap: +overlap.toFixed(3),
          strategyOverlap: +strategy.toFixed(3),
        });
    }
  const solved = rows.filter((r) => r.status === "validated");
  const bands = [
    [1, 5, "Sehr einfach"],
    [6, 15, "Einfach"],
    [16, 30, "Leicht bis mittel"],
    [31, 60, "Mittel"],
    [61, 85, "Mittel bis knifflig"],
    [86, 100, "Anspruchsvoller"],
  ] as const;
  const distribution = bands.map(([first, last, label]) => {
    const group = solved.filter(
      (r) => Number(r.id) >= first && Number(r.id) <= last,
    );
    return {
      first,
      last,
      label,
      count: group.length,
      meanScore: +(
        group.reduce((n, r) => n + r.score, 0) / (group.length || 1)
      ).toFixed(1),
      minPushes: Math.min(...group.map((r) => r.minimumPushes)),
      maxPushes: Math.max(...group.map((r) => r.minimumPushes)),
    };
  });
  return {
    levelPackId: LEVEL_PACK_ID,
    solver: "A* / minimum assignment / reachable-player-region",
    limits: limits ?? { maxStates: 150000, maxMs: 8000 },
    summary: {
      total: levels.length,
      validated: solved.length,
      failed: errors.length,
      minPushes: Math.min(...solved.map((r) => r.minimumPushes)),
      maxPushes: Math.max(...solved.map((r) => r.minimumPushes)),
      totalStates: solved.reduce((n, r) => n + r.states, 0),
      uniqueGeometries: layouts.size,
      detourLevels: solved.filter((r) => r.detourPushes > 0).length,
      distribution,
    },
    nearPairs,
    strategyPairs,
    errors,
    levels: rows,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const levels = JSON.parse(readFileSync("src/levels.json", "utf8")) as Level[];
  const report = validatePack(levels);
  writeFileSync(
    "data/level-quality.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.errors.length) {
    console.error(report.errors.join("\n"));
    process.exitCode = 1;
  }
}
