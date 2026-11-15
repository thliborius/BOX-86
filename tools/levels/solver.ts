import type { Board } from "../../src/game";

export const DIRECTIONS = [
  { dx: 0, dy: -1, letter: "U" },
  { dx: 1, dy: 0, letter: "R" },
  { dx: 0, dy: 1, letter: "D" },
  { dx: -1, dy: 0, letter: "L" },
] as const;
export type SolveResult =
  | {
      status: "solved";
      solution: string;
      pushes: number;
      moves: number;
      optimalPushes: true;
      states: number;
    }
  | { status: "unsolvable" | "limit"; states: number };
export interface Limits {
  maxStates: number;
  maxMs: number;
}
export const DEFAULT_LIMITS: Limits = { maxStates: 150_000, maxMs: 8_000 };
export function adjacent(b: Board, p: number, direction: number) {
  const d = DIRECTIONS[direction];
  const q = p + d.dx + d.dy * b.width;
  return b.floors.has(q) && Math.abs((q % b.width) - (p % b.width)) <= 1
    ? q
    : -1;
}
/** Flood fill also records shortest walking routes, without calling game.move. */
export function reachable(b: Board, player: number, boxes: readonly number[]) {
  const blocked = new Set(boxes),
    queue = [player],
    parent = new Map<number, [number, number]>();
  parent.set(player, [-1, -1]);
  for (let i = 0; i < queue.length; i++)
    for (let d = 0; d < 4; d++) {
      const q = adjacent(b, queue[i], d);
      if (q >= 0 && !blocked.has(q) && !parent.has(q)) {
        parent.set(q, [queue[i], d]);
        queue.push(q);
      }
    }
  return { cells: parent, anchor: Math.min(...queue) };
}
export function walkingPath(
  parents: Map<number, [number, number]>,
  target: number,
): string {
  let path = "",
    p = target;
  while (parents.get(p)![0] >= 0) {
    const [previous, d] = parents.get(p)!;
    path = DIRECTIONS[d].letter + path;
    p = previous;
  }
  return path;
}
/** Reverse single-crate distances: a push needs floor on both sides of the crate. */
export function goalDistances(b: Board) {
  return [...b.goals].map((goal) => {
    const dist = new Map<number, number>([[goal, 0]]),
      queue = [goal];
    for (let i = 0; i < queue.length; i++)
      for (let d = 0; d < 4; d++) {
        const previous = adjacent(b, queue[i], d);
        if (previous < 0 || adjacent(b, previous, d) < 0 || dist.has(previous))
          continue;
        dist.set(previous, dist.get(queue[i])! + 1);
        queue.push(previous);
      }
    return dist;
  });
}
export function deadSquares(b: Board): Set<number> {
  const distances = goalDistances(b);
  return new Set(
    [...b.floors].filter((p) => distances.every((d) => !d.has(p))),
  );
}
/** A filled 2×2 block cannot release any of its crates. */
export function frozenSquare(b: Board, boxes: readonly number[]): boolean {
  const occupied = new Set(boxes);
  for (const p of boxes)
    for (const offset of [0, -1, -b.width, -b.width - 1]) {
      const start = p + offset,
        square = [start, start + 1, start + b.width, start + b.width + 1];
      if (
        square.every((q) => b.walls.has(q) || occupied.has(q)) &&
        square.some((q) => occupied.has(q) && !b.goals.has(q))
      )
        return true;
    }
  return false;
}
export function assignmentCost(
  boxes: readonly number[],
  distances: Map<number, number>[],
) {
  // Minimum distinct-goal assignment is an admissible lower bound and rejects impossible matchings.
  let costs = new Map<number, number>([[0, 0]]);
  for (const box of boxes) {
    const next = new Map<number, number>();
    for (const [mask, cost] of costs)
      for (let i = 0; i < distances.length; i++) {
        if (mask & (1 << i)) continue;
        const distance = distances[i].get(box);
        if (distance === undefined) continue;
        const m = mask | (1 << i),
          value = cost + distance;
        if (value < (next.get(m) ?? Infinity)) next.set(m, value);
      }
    costs = next;
  }
  return costs.get((1 << boxes.length) - 1) ?? Infinity;
}
interface Node {
  boxes: number[];
  player: number;
  key: string;
  g: number;
  f: number;
  parent?: Node;
  segment: string;
}
class Heap {
  items: Node[] = [];
  push(n: Node) {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= n.f) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = n;
  }
  pop() {
    const a = this.items,
      first = a[0],
      last = a.pop()!;
    if (a.length) {
      let i = 0;
      while (2 * i + 1 < a.length) {
        let child = 2 * i + 1;
        if (child + 1 < a.length && a[child + 1].f < a[child].f) child++;
        if (last.f <= a[child].f) break;
        a[i] = a[child];
        i = child;
      }
      a[i] = last;
    }
    return first;
  }
}
/** A* over pushes; player regions are canonicalized. Walking length is not optimized. */
export function solve(b: Board, limits: Limits = DEFAULT_LIMITS): SolveResult {
  const deadline = performance.now() + limits.maxMs,
    distances = goalDistances(b);
  const dead = new Set(
    [...b.floors].filter((p) => distances.every((d) => !d.has(p))),
  );
  const boxes = [...b.boxes].sort((a, c) => a - c);
  const key = (bs: number[], anchor: number) => bs.join(",") + ":" + anchor;
  const rootKey = key(boxes, reachable(b, b.player, boxes).anchor);
  const root: Node = {
    boxes,
    player: b.player,
    key: rootKey,
    g: 0,
    f: assignmentCost(boxes, distances),
    segment: "",
  };
  const best = new Map([[rootKey, 0]]),
    heap = new Heap();
  heap.push(root);
  let states = 0;
  while (heap.items.length) {
    if (best.size >= limits.maxStates || performance.now() >= deadline)
      return { status: "limit", states };
    const n = heap.pop();
    if (n.g !== best.get(n.key)) continue;
    states++;
    if (n.boxes.every((p) => b.goals.has(p))) {
      const segments: string[] = [];
      let cursor: Node | undefined = n;
      while (cursor?.parent) {
        segments.push(cursor.segment);
        cursor = cursor.parent;
      }
      const solution = segments.reverse().join("");
      return {
        status: "solved",
        solution,
        pushes: n.g,
        moves: solution.length,
        optimalPushes: true,
        states,
      };
    }
    const area = reachable(b, n.player, n.boxes),
      occupied = new Set(n.boxes);
    for (let i = 0; i < n.boxes.length; i++)
      for (let d = 0; d < 4; d++) {
        const box = n.boxes[i],
          target = adjacent(b, box, d),
          behind = adjacent(b, box, (d + 2) % 4);
        if (
          target < 0 ||
          occupied.has(target) ||
          dead.has(target) ||
          !area.cells.has(behind)
        )
          continue;
        const bs = n.boxes.slice();
        bs[i] = target;
        bs.sort((a, c) => a - c);
        if (frozenSquare(b, bs)) continue;
        const k = key(bs, reachable(b, box, bs).anchor),
          g = n.g + 1;
        if ((best.get(k) ?? Infinity) <= g) continue;
        const h = assignmentCost(bs, distances);
        if (!Number.isFinite(h)) continue;
        best.set(k, g);
        heap.push({
          boxes: bs,
          player: box,
          key: k,
          g,
          f: g + h,
          parent: n,
          segment: walkingPath(area.cells, behind) + DIRECTIONS[d].letter,
        });
      }
  }
  return { status: "unsolvable", states };
}
