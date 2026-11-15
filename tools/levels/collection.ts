import { parse, type Level } from "../../src/game";
import { candidate } from "./generator";
import { tutorials } from "./tutorial";
import { solve } from "./solver";
import { verify } from "./verify";

export type Selection =
  | { kind: "handcrafted"; name: string }
  | { kind: "generated"; name: string; seed: number; boxes: number };

/** Final one-based positions; all other entries retain their relative order. Idempotent. */
export function orderCollection<T extends { name: string }>(
  entries: readonly T[],
): T[] {
  const moves = [
    { name: "Drei Plätze", position: 20 },
    { name: "Ende der Frühschicht", position: 24 },
  ];
  const moved = moves.map((move) => {
    const matches = entries.filter((entry) => entry.name === move.name);
    if (matches.length !== 1) throw Error(`Expected exactly one ${move.name}`);
    return matches[0];
  });
  const ordered = entries.filter(
    (entry) => !moves.some((move) => move.name === entry.name),
  );
  moves.forEach((move, i) => ordered.splice(move.position - 1, 0, moved[i]));
  return ordered;
}

/** Rebuild only the frozen choices; no candidate discovery or reselection. */
export function buildCollection(selection: readonly Selection[]): Level[] {
  if (selection.length !== 100) throw Error("Expected 100 levels");
  return orderCollection(selection).map((s, i) => {
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
}
