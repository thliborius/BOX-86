import { describe, it, expect } from "vitest";
import { empty, load, save, recordWin, KEY } from "./storage";
import { LEVEL_PACK_ID } from "./pack";
function memory(value: string | null = null) {
  const data = new Map<string, string>(value === null ? [] : [[KEY, value]]);
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
describe("pack progress", () => {
  it("keeps independent minima and last played room across saves", () => {
    const p = empty(),
      store = memory();
    p.lastLevel = "100";
    recordWin(p, "20", 30, 12);
    recordWin(p, "20", 35, 9);
    recordWin(p, "20", 25, 14);
    recordWin(p, "20", 40, 20);
    expect(p.completed["20"]).toEqual({ bestMoves: 25, bestPushes: 9 });
    expect(save(store, p)).toBe(true);
    expect(load(store)).toEqual(p);
    const next = load(store);
    next.lastLevel = "1";
    save(store, next);
    expect(load(store).completed["20"]).toEqual({
      bestMoves: 25,
      bestPushes: 9,
    });
    expect(load(store).lastLevel).toBe("1");
  });
  it("invalidates old pack results while retaining general settings", () => {
    for (const legacy of [
      {
        version: 1,
        lastLevel: "box86-009",
        completed: { "box86-001": { moves: 3, pushes: 2 } },
      },
      {
        ...empty(),
        levelPackId: "previous-pack",
        lastLevel: "10",
        completed: { "1": { bestMoves: 8, bestPushes: 4 } },
      },
      {
        version: 99,
        lastLevel: "100",
        completed: { "1": { bestMoves: 8, bestPushes: 4 } },
      },
    ]) {
      const store = memory(
        JSON.stringify({
          ...legacy,
          settings: { scanlines: true, volume: 0, label: "local" },
        }),
      );
      store.data.set("unrelated.preferences", "preserve");
      const migrated = load(store);
      expect(migrated.completed).toEqual({});
      expect(migrated.lastLevel).toBe("1");
      expect(migrated.settings).toEqual({
        scanlines: true,
        volume: 0,
        label: "local",
      });
      save(store, migrated);
      expect(load(store)).toEqual(migrated);
      expect(store.data.get("unrelated.preferences")).toBe("preserve");
    }
  });
  it("rejects malformed records, unsafe counts and invalid IDs", () => {
    for (const data of [
      "broken",
      "null",
      "[]",
      '{"completed":null}',
      '{"version":2}',
    ])
      expect(load(memory(data))).toEqual(empty());
    const p = {
      ...empty(),
      lastLevel: "101",
      completed: {
        "1": { bestMoves: 12, bestPushes: 4 },
        "2": { bestMoves: 2, bestPushes: 3 },
        "3": { bestMoves: Infinity, bestPushes: 1 },
        "01": { bestMoves: 9, bestPushes: 2 },
        "100": { bestMoves: 9, bestPushes: 0 },
      },
    };
    const result = load(memory(JSON.stringify(p)));
    expect(result.lastLevel).toBe("1");
    expect(Object.keys(result.completed)).toEqual(["1"]);
    expect(result.levelPackId).toBe(LEVEL_PACK_ID);
    expect(() => recordWin(empty(), "101", 2, 1)).toThrow();
    expect(() => recordWin(empty(), "1", 2, 3)).toThrow();
  });
  it("retains the existing release pack, results and new preferences without migration", () => {
    const p = empty();
    p.lastLevel = "53";
    recordWin(p, "1", 7, 3);
    p.settings = { scanlines: true, muted: true, showControls: false };
    const store = memory();
    save(store, p);
    expect(load(store)).toEqual(p);
  });
  it("resets v1 pack test progress while preserving sound and CRT settings", () => {
    const old = {
      ...empty(),
      levelPackId: "warehouse-100-v1",
      lastLevel: "15",
      completed: { "14": { bestMoves: 24, bestPushes: 9 } },
      settings: { muted: true, scanlines: true, showControls: false },
    };
    const store = memory(JSON.stringify(old));
    const updated = load(store);
    expect(updated.levelPackId).toBe("warehouse-100-v2");
    expect(updated.lastLevel).toBe("1");
    expect(updated.completed).toEqual({});
    expect(updated.settings).toEqual(old.settings);
    save(store, updated);
    expect(load(store)).toEqual(updated);
  });
  it("survives unavailable and full storage", () => {
    expect(
      load({
        getItem: () => {
          throw Error("disabled");
        },
      }),
    ).toEqual(empty());
    expect(
      save(
        {
          setItem: () => {
            throw Error("full");
          },
        },
        empty(),
      ),
    ).toBe(false);
  });
});
