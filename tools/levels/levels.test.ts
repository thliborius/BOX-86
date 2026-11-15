import { describe, it, expect } from "vitest";
import {
  parse,
  initial,
  move,
  won,
  type State,
  type Level,
} from "../../src/game";
import { levels } from "../../src/levels";
import { solve, deadSquares, frozenSquare, reachable } from "./solver";
import { verify } from "./verify";
import { tutorials } from "./tutorial";
import { candidate, serialize } from "./generator";
import { canonical, strategySignature, strategySimilarity } from "./duplicates";
import { validatePack } from "./validate";

// Small reference search deliberately uses individual engine moves, without solver pruning.
function referencePushes(map: string) {
  const b = parse(map),
    queue: State[] = [initial(b)],
    seen = new Map<string, number>();
  while (queue.length) {
    queue.sort((a, b) => b.pushes - a.pushes);
    const s = queue.pop()!;
    const key =
      s.player +
      ":" +
      s.boxes
        .slice()
        .sort((a, b) => a - b)
        .join(",");
    if ((seen.get(key) ?? Infinity) <= s.pushes) continue;
    seen.set(key, s.pushes);
    if (won(b, s)) return s.pushes;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = move(b, s, dx, dy);
      if (n !== s) queue.push(n);
    }
    if (seen.size > 20000) throw Error("Reference search guard");
  }
  return Infinity;
}
describe("independent push solver", () => {
  it("agrees with a separate engine-step search on small boards", () => {
    for (const t of [tutorials[0], tutorials[1], tutorials[2], tutorials[7]]) {
      const r = solve(parse(t.map));
      expect(r.status).toBe("solved");
      if (r.status === "solved") expect(r.pushes).toBe(referencePushes(t.map));
    }
  });
  it("finds optimal pushes and reconstructs walking around a wall", () => {
    const t = tutorials[0],
      r = solve(parse(t.map));
    expect(r.status).toBe("solved");
    if (r.status !== "solved") throw Error();
    expect(r.pushes).toBe(3);
    expect(r.moves).toBeGreaterThan(r.pushes);
    expect(verify(t.map, r.solution, r.pushes).pushes).toBe(3);
  });
  it("solves a three-crate ordering scenario", () => {
    const t = tutorials[14],
      r = solve(parse(t.map));
    expect(r.status).toBe("solved");
    if (r.status === "solved") {
      expect(r.pushes).toBe(9);
      expect(verify(t.map, r.solution, r.pushes).moves).toBe(r.moves);
    }
  });
  it("detects corner dead squares and frozen 2×2 groups", () => {
    const b = parse("#######\n#@    #\n# $$  #\n# $$..#\n#   ..#\n#######");
    expect(deadSquares(b).has(8)).toBe(true);
    expect(frozenSquare(b, b.boxes)).toBe(true);
    expect(solve(b).status).toBe("unsolvable");
    const solved = parse("######\n#@   #\n# ** #\n# ** #\n######");
    expect(frozenSquare(solved, solved.boxes)).toBe(false);
    expect(solve(solved).status).toBe("solved");
    expect(solve(parse("#####\n#$@.#\n#   #\n#####")).status).toBe(
      "unsolvable",
    );
  });
  it("normalizes equivalent reachable player positions", () => {
    const b = parse(tutorials[0].map),
      a = reachable(b, b.player, b.boxes),
      q = [...a.cells.keys()].at(-1)!;
    expect(reachable(b, q, b.boxes).anchor).toBe(a.anchor);
  });
  it("never mistakes a search limit or an invalid replay for success", () => {
    expect(
      solve(parse(tutorials[0].map), { maxStates: 1, maxMs: 1000 }).status,
    ).toBe("limit");
    expect(
      solve(parse(tutorials[0].map), { maxStates: 1000, maxMs: 0 }).status,
    ).toBe("limit");
    expect(() => verify(tutorials[0].map, "X")).toThrow();
    expect(() => verify(tutorials[0].map, "RRRR")).toThrow();
    expect(() => verify(tutorials[0].map, "")).toThrow();
  });
});
describe("offline generation and duplicates", () => {
  it("produces deterministic candidates that independently solve", () => {
    const collect = () =>
      Array.from({ length: 40 }, (_, i) => candidate(870001 + i, 2)).filter(
        (c) => c !== null,
      );
    const a = collect();
    expect(a.length).toBeGreaterThan(0);
    expect(collect()).toEqual(a);
    for (const c of a.slice(0, 8)) {
      const b = parse(c.map);
      expect(serialize(b, b.player, b.boxes)).toBe(c.map);
      const r = solve(b);
      expect(r.status).toBe("solved");
      if (r.status === "solved") verify(c.map, r.solution, r.pushes);
    }
  });
  it("normalizes exact, rotated, reflected and wall-padded copies", () => {
    const map = tutorials[0].map,
      rows = map.split("\n");
    const mirror = rows.map((r) => [...r].reverse().join("")).join("\n");
    const rotate = Array.from({ length: rows[0].length }, (_, x) =>
      rows
        .map((r) => r[x])
        .reverse()
        .join(""),
    ).join("\n");
    const pad = "#".repeat(rows[0].length + 4),
      shift = [pad, pad, ...rows.map((r) => "##" + r + "##"), pad].join("\n");
    expect(canonical(map)).toBe(canonical(mirror));
    expect(canonical(map)).toBe(canonical(rotate));
    expect(canonical(map)).toBe(canonical(shift));
    expect(canonical(map, true)).not.toBe(canonical(tutorials[4].map, true));
  });
});
it("normalizes related solution motifs but distinguishes crate order", () => {
  expect(strategySignature("2U-2R-0U")).toBe(strategySignature("4D-4L-3D"));
  expect(strategySimilarity("2U-2R-0U", "4D-4L-3D")).toBe(1);
  expect(strategySimilarity("0U-0R-0D", "0U-1R-2D")).toBeLessThan(1);
});
describe("final collection", () => {
  it("validates all 100 levels, optimal solutions and independent replays", () => {
    const report = validatePack(levels);
    expect(report.errors).toEqual([]);
    expect(report.summary.validated).toBe(100);
    expect(report.summary.uniqueGeometries).toBe(100);
    expect(report.nearPairs).toEqual([]);
    expect(report.strategyPairs).toEqual([]);
    expect(report.summary.detourLevels).toBeGreaterThanOrEqual(85);
    expect(report.summary.distribution.map((d) => d.count)).toEqual([
      5, 10, 15, 30, 25, 15,
    ]);
    const means = report.summary.distribution.map((d) => d.meanScore);
    expect(means).toEqual([...means].sort((a, b) => a - b));
  }, 120000);
  it("rejects invalid IDs, duplicate maps and already solved starts", () => {
    const bad: Level[] = [
      { ...levels[0], id: "wrong" },
      { ...levels[0], id: "2" },
      { ...levels[0], id: "3" },
      { id: "4", name: "done", map: "#####\n#@* #\n#   #\n#   #\n#####" },
      { id: "5", name: "missing map", map: undefined as unknown as string },
      { id: "6", name: "isolated", map: "#######\n#@$.# #\n##### #\n#     #\n#######" },
    ];
    const r = validatePack(bad);
    expect(r.errors.length).toBeGreaterThan(3);
    expect(r.levels[4].status).toBe("failed");
    expect(r.levels[5].status).toBe("failed");
  });
});
