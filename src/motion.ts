export interface FrameClock {
  now(): number;
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}
/** One animation at a time. Cancel settles pending work, so pause cannot leave input locked. */
export class Motion {
  private finish?: (completed: boolean) => void;
  private handle = 0;
  constructor(
    private clock: FrameClock = {
      now: () => performance.now(),
      request: (callback) => requestAnimationFrame(callback),
      cancel: (id) => cancelAnimationFrame(id),
    },
  ) {}
  get busy() {
    return this.finish !== undefined;
  }
  run(duration: number, frame: (progress: number) => void): Promise<boolean> {
    if (this.busy) return Promise.resolve(false);
    if (duration <= 0) {
      frame(1);
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const start = this.clock.now();
      this.finish = (completed) => {
        this.clock.cancel(this.handle);
        this.finish = undefined;
        resolve(completed);
      };
      const tick = (time: number) => {
        const progress = Math.min(1, Math.max(0, (time - start) / duration));
        frame(progress);
        if (progress === 1) this.finish?.(true);
        else this.handle = this.clock.request(tick);
      };
      frame(0);
      this.handle = this.clock.request(tick);
    });
  }
  cancel() {
    this.finish?.(false);
  }
}

export function swipeDirection(
  dx: number,
  dy: number,
  threshold = 18,
): [number, number] | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy) * 1.15) return [Math.sign(dx), 0];
  if (Math.abs(dy) > Math.abs(dx) * 1.15) return [0, Math.sign(dy)];
  return null; // Ambiguous diagonal swipes do not move the player.
}
