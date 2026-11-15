import { Game, parse } from "../../src/game";
import {
  adjacent,
  assignmentCost,
  goalDistances,
  deadSquares,
  DIRECTIONS,
  reachable,
  type SolveResult,
} from "./solver";
export type Solved = Extract<SolveResult, { status: "solved" }>;
export function analyze(map: string, result: Solved) {
  const b = parse(map),
    game = new Game(b),
    dead = deadSquares(b);
  const identities = b.boxes.slice();
  let turns = 0,
    switches = 0,
    repositionings = 0,
    goalWithdrawals = 0,
    alternatives = 0;
  let lastDirection = -1,
    lastBox = -1,
    walk = 0;
  const pushPattern: string[] = [];
  for (const letter of result.solution) {
    const direction = DIRECTIONS.findIndex((d) => d.letter === letter),
      d = DIRECTIONS[direction];
    const target = adjacent(b, game.state.player, direction),
      box = identities.indexOf(target);
    if (box >= 0) {
      if (lastDirection >= 0 && lastDirection !== direction) turns++;
      if (lastBox >= 0 && lastBox !== box) switches++;
      if (walk > 0 && lastDirection >= 0) repositionings++;
      if (b.goals.has(target)) goalWithdrawals++;
      const area = reachable(b, game.state.player, game.state.boxes);
      let choices = 0;
      for (const p of game.state.boxes)
        for (let i = 0; i < 4; i++) {
          const q = adjacent(b, p, i),
            behind = adjacent(b, p, (i + 2) % 4);
          if (
            q >= 0 &&
            !dead.has(q) &&
            !game.state.boxes.includes(q) &&
            area.cells.has(behind)
          )
            choices++;
        }
      alternatives += choices;
      identities[box] = adjacent(b, target, direction);
      if (lastBox !== box || lastDirection !== direction)
        pushPattern.push(`${box}${letter}`);
      lastDirection = direction;
      lastBox = box;
      walk = 0;
    } else walk++;
    game.step(d.dx, d.dy);
  }
  let bottlenecks = 0;
  for (const p of b.floors) {
    const other = [...b.floors].find((q) => q !== p)!;
    if (reachable(b, other, [p]).cells.size < b.floors.size - 1) bottlenecks++;
  }
  const detourPushes =
    result.pushes - assignmentCost(b.boxes, goalDistances(b));
  const deadlockRatio = dead.size / b.floors.size;
  const averageAlternatives = alternatives / result.pushes;
  // Walking distance alone is deliberately absent; only changes of working position count.
  const score =
    Math.round(
      (detourPushes * 2.5 +
        result.pushes * 0.65 +
        b.boxes.length * 2.5 +
        turns * 1.1 +
        switches * 1.3 +
        repositionings * 0.7 +
        goalWithdrawals * 2 +
        Math.log2(result.states + 1) * 1.1 +
        Math.min(bottlenecks, 8) * 0.45 +
        deadlockRatio * 3 +
        Math.min(averageAlternatives, 8) * 0.4) *
        10,
    ) / 10;
  return {
    score,
    detourPushes,
    turns,
    switches,
    repositionings,
    goalWithdrawals,
    bottlenecks,
    deadlockRatio: +deadlockRatio.toFixed(3),
    averageAlternatives: +averageAlternatives.toFixed(2),
    pushPattern: pushPattern.join("-"),
    floorCells: b.floors.size,
  };
}
export function isInteresting(map: string, r: Solved, tutorial = false) {
  const q = analyze(map, r),
    b = parse(map);
  return (
    r.pushes >= (tutorial ? 3 : 8) &&
    q.turns >= (tutorial ? 1 : 3) &&
    q.repositionings >= (tutorial ? 1 : 3) &&
    (b.boxes.length === 1 || q.switches >= 1)
  );
}
