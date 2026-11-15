import { describe, it, expect, vi } from "vitest";
import { RetroAudio } from "./audio";
function context(state = "running") {
  const oscillators: { stop: ReturnType<typeof vi.fn> }[] = [];
  const c = {
    state,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {}),
    createGain: vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn(() => {
      const o = {
        type: "",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      oscillators.push(o);
      return o;
    }),
  };
  return { c, oscillators, factory: vi.fn(() => c as unknown as AudioContext) };
}
describe("quiet lazy audio", () => {
  it("never creates audio on construction or while muted", () => {
    const mock = context(),
      audio = new RetroAudio(mock.factory);
    expect(mock.factory).not.toHaveBeenCalled();
    audio.setMuted(true);
    audio.play("menu");
    expect(mock.factory).not.toHaveBeenCalled();
    audio.setMuted(false);
    audio.play("push");
    expect(mock.factory).toHaveBeenCalledTimes(1);
    mock.c.currentTime = 1;
    audio.play("walk");
    expect(mock.factory).toHaveBeenCalledTimes(1);
  });
  it("silences scheduled notes immediately on mute", () => {
    const mock = context(),
      audio = new RetroAudio(mock.factory);
    audio.play("win");
    expect(mock.oscillators.length).toBeGreaterThan(1);
    audio.setMuted(true);
    expect(mock.oscillators.every((o) => o.stop.mock.calls.length === 2)).toBe(
      true,
    );
    audio.play("win");
    expect(mock.oscillators.length).toBe(4);
  });
  it("does not play a pending resume after being muted", async () => {
    const mock = context("suspended"),
      audio = new RetroAudio(mock.factory);
    audio.play("menu");
    audio.setMuted(true);
    await Promise.resolve();
    expect(mock.c.createOscillator).not.toHaveBeenCalled();
  });
  it("survives unavailable audio and rejected activation", async () => {
    const audio = new RetroAudio(() => {
      throw Error("unavailable");
    });
    expect(() => audio.play("menu")).not.toThrow();
    const mock = context("suspended");
    mock.c.resume.mockRejectedValue(Error("blocked"));
    new RetroAudio(mock.factory).play("win");
    await Promise.resolve();
    await Promise.resolve();
  });
});
