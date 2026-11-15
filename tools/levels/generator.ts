import { parse, type Board } from "../../src/game";
import { adjacent, reachable } from "./solver";

export function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function serialize(b: Board, player: number, boxes: readonly number[]) {
  return Array.from({ length: b.height }, (_, y) =>
    Array.from({ length: b.width }, (_, x) => {
      const p = y * b.width + x;
      if (!b.floors.has(p)) return "#";
      if (player === p) return b.goals.has(p) ? "+" : "@";
      if (boxes.includes(p)) return b.goals.has(p) ? "*" : "$";
      return b.goals.has(p) ? "." : " ";
    }).join(""),
  ).join("\n");
}
export type Archetype = "pillars" | "bays" | "rooms" | "dogleg" | "island";
export const archetypes: Archetype[] = [
  "pillars",
  "bays",
  "rooms",
  "dogleg",
  "island",
];
/** Varied compact architectural motifs, not transformations of fixed puzzles. */
function geometry(seed: number, count: number) {
  const rng = random(seed),
    pick = (n: number) => Math.floor(rng() * n);
  const w = 7 + pick(count > 3 ? 4 : 3),
    h = 6 + pick(count > 3 ? 4 : 3);
  const floors = new Set<number>();
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) floors.add(y * w + x);
  const kind = archetypes[seed % archetypes.length];
  if (kind === "rooms") {
    const wallX = 2 + pick(w - 4),
      doorY = 2 + pick(h - 4);
    for (let y = 1; y < h - 1; y++)
      if (y !== doorY && y !== doorY + 1) floors.delete(y * w + wallX);
  } else if (kind === "dogleg") {
    const left = 1 + pick(2),
      right = w - 2 - pick(2);
    for (let y = 1; y < h - 1; y++) {
      const from = y < h / 2 ? left : 1,
        to = y < h / 2 ? w - 2 : right;
      for (let x = 1; x < from; x++) floors.delete(y * w + x);
      for (let x = to + 1; x < w - 1; x++) floors.delete(y * w + x);
    }
  } else if (kind === "island") {
    const x = 2 + pick(w - 4),
      y = 2 + pick(h - 4);
    floors.delete(y * w + x);
    if (rng() < 0.7) floors.delete((y + 1) * w + x);
    if (rng() < 0.4) floors.delete(y * w + x + 1);
  }
  const removals = 2 + pick(Math.floor((w - 2) * (h - 2) * 0.18));
  for (let i = 0; i < removals; i++) {
    let x = 1 + pick(w - 2),
      y = 1 + pick(h - 2);
    if (kind === "bays") {
      if (i % 2) x = rng() < 0.5 ? 1 : w - 2;
      else y = rng() < 0.5 ? 1 : h - 2;
    }
    floors.delete(y * w + x);
  }
  const b: Board = {
    width: w,
    height: h,
    floors,
    walls: new Set(),
    goals: new Set(),
    boxes: [],
    player: [...floors][0],
  };
  for (let p = 0; p < w * h; p++) if (!floors.has(p)) b.walls.add(p);
  if (
    floors.size < count * 4 + 9 ||
    floors.size > 45 ||
    reachable(b, b.player, []).cells.size !== floors.size
  )
    return null;
  return { b, kind, rng };
}
/** Seed fixes geometry, goals, and the entire reverse scramble. No forward search is called. */
export function candidate(
  seed: number,
  count: number,
): { map: string; archetype: Archetype; seed: number } | null {
  const g = geometry(seed, count);
  if (!g) return null;
  const { b, kind, rng } = g,
    pick = (n: number) => Math.floor(rng() * n);
  const floor = [...b.floors];
  // Goal sites need at least one legal reverse pull; corners can be legitimate final goals.
  const sites = floor.filter((p) =>
    [0, 1, 2, 3].some((d) => {
      const q = adjacent(b, p, d);
      return q >= 0 && adjacent(b, q, d) >= 0;
    }),
  );
  if (sites.length < count) return null;
  const goals = sites; // Fisher-Yates below is deterministic.
  for (let i = goals.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [goals[i], goals[j]] = [goals[j], goals[i]];
  }
  b.goals = new Set(goals.slice(0, count));
  let boxes = [...b.goals],
    player = floor.find((p) => !boxes.includes(p))!;
  const visits = new Map<string, number>();
  let best: { boxes: number[]; player: number; value: number } | undefined;
  for (let step = 0; step < 90 + count * 25; step++) {
    const area = reachable(b, player, boxes);
    const options: {
      boxes: number[];
      player: number;
      key: string;
      weight: number;
    }[] = [];
    for (let i = 0; i < boxes.length; i++)
      for (let d = 0; d < 4; d++) {
        const near = adjacent(b, boxes[i], d),
          far = near < 0 ? -1 : adjacent(b, near, d);
        if (
          far < 0 ||
          boxes.includes(far) ||
          boxes.includes(near) ||
          !area.cells.has(near)
        )
          continue;
        const bs = boxes.slice();
        bs[i] = near;
        const key =
          bs
            .slice()
            .sort((a, c) => a - c)
            .join(",") +
          ":" +
          reachable(b, far, bs).anchor;
        options.push({
          boxes: bs,
          player: far,
          key,
          weight: 1 / (1 + (visits.get(key) ?? 0) * 4),
        });
      }
    if (!options.length) break;
    let roll = rng() * options.reduce((sum, o) => sum + o.weight, 0);
    const chosen =
      options.find((o) => (roll -= o.weight) <= 0) ??
      options[options.length - 1];
    boxes = chosen.boxes;
    player = chosen.player;
    visits.set(chosen.key, (visits.get(chosen.key) ?? 0) + 1);
    const distance = boxes.reduce(
      (sum, p) =>
        sum +
        Math.min(
          ...[...b.goals].map(
            (q) =>
              Math.abs((p % b.width) - (q % b.width)) +
              Math.abs(Math.floor(p / b.width) - Math.floor(q / b.width)),
          ),
        ),
      0,
    );
    const crowding = boxes.reduce(
      (sum, p) =>
        sum +
        boxes.filter(
          (q) =>
            q !== p &&
            Math.abs((p % b.width) - (q % b.width)) +
              Math.abs(Math.floor(p / b.width) - Math.floor(q / b.width)) ===
              1,
        ).length,
      0,
    );
    const wallContact = boxes.reduce(
      (sum, p) =>
        sum + [0, 1, 2, 3].filter((d) => adjacent(b, p, d) < 0).length,
      0,
    );
    const value =
      distance +
      boxes.filter((p) => !b.goals.has(p)).length * 3 +
      crowding * 2 +
      wallContact * 0.7 +
      rng() * 4;
    if (!best || value > best.value)
      best = { boxes: boxes.slice(), player, value };
  }
  if (!best || best.boxes.every((p) => b.goals.has(p))) return null;
  b.boxes = best.boxes;
  b.player = best.player;
  const map = serialize(b, b.player, b.boxes);
  parse(map); // Format guard only, deliberately not a solvability certificate.
  return { map, archetype: kind, seed };
}
