import { describe, it, expect } from "vitest";
import { Motion, swipeDirection, type FrameClock } from "./motion";
function clock() {
  let now = 0,
    id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const api: FrameClock = {
    now: () => now,
    request: (cb) => {
      frames.set(++id, cb);
      return id;
    },
    cancel: (key) => {
      frames.delete(key);
    },
  };
  return {
    api,
    tick: (ms: number) => {
      now = ms;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((cb) => cb(now));
    },
  };
}
describe("motion input lock", () => {
  it("accepts one animation and rejects overlapping input until it finishes", async () => {
    const c = clock(),
      m = new Motion(c.api),
      frames: number[] = [];
    const first = m.run(100, (p) => frames.push(p));
    expect(m.busy).toBe(true);
    expect(
      await m.run(100, () => {
        throw Error("overlapping frame");
      }),
    ).toBe(false);
    c.tick(50);
    expect(frames.at(-1)).toBe(0.5);
    c.tick(100);
    expect(await first).toBe(true);
    expect(m.busy).toBe(false);
  });
  it("releases input and settles pending work when paused or replaced", async () => {
    const c = clock(),
      m = new Motion(c.api),
      frames: number[] = [];
    const first = m.run(100, (p) => frames.push(p));
    m.cancel();
    expect(await first).toBe(false);
    expect(m.busy).toBe(false);
    const second = m.run(40, (p) => frames.push(p));
    c.tick(40);
    expect(await second).toBe(true);
    expect(frames).toEqual([0, 0, 1]);
  });
  it("honors reduced motion without creating a lock or scheduling frames", async () => {
    const c = clock(),
      m = new Motion(c.api),
      frames: number[] = [];
    expect(await m.run(0, (p) => frames.push(p))).toBe(true);
    expect(m.busy).toBe(false);
    expect(frames).toEqual([1]);
  });
});
describe("swipes", () => {
  it("maps dominant swipes to one step and ignores taps and ambiguous diagonals", () => {
    expect(swipeDirection(60, 5)).toEqual([1, 0]);
    expect(swipeDirection(-60, 0)).toEqual([-1, 0]);
    expect(swipeDirection(2, -40)).toEqual([0, -1]);
    expect(swipeDirection(0, 40)).toEqual([0, 1]);
    expect(swipeDirection(12, 4)).toBeNull();
    expect(swipeDirection(50, 50)).toBeNull();
  });
});
