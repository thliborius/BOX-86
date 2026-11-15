import { Game, parse, won } from "../../src/game";
import { DIRECTIONS } from "./solver";

/** Deliberately replay through the actual engine, independently of solver transitions. */
export function verify(map: string, solution: string, expectedPushes?: number) {
  const game = new Game(parse(map));
  for (const [i, letter] of [...solution].entries()) {
    const d = DIRECTIONS.find((d) => d.letter === letter);
    if (!d) throw Error(`Invalid solution symbol at step ${i + 1}`);
    const before = game.state;
    game.step(d.dx, d.dy);
    if (before === game.state) throw Error(`Blocked solution step ${i + 1}`);
  }
  if (!won(game.board, game.state))
    throw Error("Solution does not finish the level");
  if (expectedPushes !== undefined && game.state.pushes !== expectedPushes)
    throw Error("Push count mismatch");
  return game.state;
}
