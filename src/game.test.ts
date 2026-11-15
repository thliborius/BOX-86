import { describe, it, expect } from "vitest";
import { Game, parse, move, initial, won } from "./game";
describe("rules", () => {
  it("walks, collides, pushes, wins, undoes and restarts", () => {
    const g = new Game(parse("#######\n#@ $. #\n#######"));
    g.step(0, -1);
    expect(g.state.moves).toBe(0);
    g.step(1, 0);
    expect(g.state.pushes).toBe(0);
    g.step(1, 0);
    expect(won(g.board, g.state)).toBe(true);
    expect(g.state.pushes).toBe(1);
    g.undo();
    expect(won(g.board, g.state)).toBe(false);
    expect(g.state.moves).toBe(1);
    g.undo();
    g.undo();
    expect(g.state).toEqual(initial(g.board));
    g.step(1, 0);
    g.restart();
    expect(g.history).toHaveLength(0);
    expect(g.state.moves).toBe(0);
  });
  it("cannot push two crates or push into walls or pull", () => {
    const g = new Game(parse("########\n#@$$ ..#\n########"));
    g.step(1, 0);
    expect(g.state.moves).toBe(0);
    const h = new Game(parse("######\n# .$@#\n######"));
    h.step(0, 1);
    expect(h.state.moves).toBe(0);
    h.step(-1, 0);
    h.step(1, 0);
    expect(h.state.boxes).toEqual([8]);
    h.step(-1, 0);
    h.step(-1, 0);
    const before = h.state;
    h.step(-1, 0);
    expect(h.state).toBe(before);
  });
  it("validates maps and combined tiles", () => {
    expect(() => parse("###\n#@#")).toThrow();
    expect(() => parse("###\n#x#\n###")).toThrow();
    expect(() => parse("###\n @#\n###")).toThrow();
    expect(parse("#####\n#+* #\n# $ #\n#####").goals.size).toBe(2);
  });
});
