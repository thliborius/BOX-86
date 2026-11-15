export type Sound = "walk" | "push" | "win" | "menu";
const notes: Record<Sound, { volume: number; tones: [number, number][] }> = {
  walk: { volume: 0.006, tones: [[145, 0.018]] },
  push: {
    volume: 0.016,
    tones: [
      [105, 0.035],
      [160, 0.035],
    ],
  },
  menu: { volume: 0.01, tones: [[480, 0.025]] },
  win: {
    volume: 0.02,
    tones: [
      [523.25, 0.055],
      [659.25, 0.055],
      [783.99, 0.055],
      [1046.5, 0.13],
    ],
  },
};
/** A single lazy PC-speaker voice. Construction and settings never start audio. */
export class RetroAudio {
  private context?: AudioContext;
  private active = new Set<OscillatorNode>();
  private generation = 0;
  private lastSound = -Infinity;
  muted = false;
  constructor(private create: () => AudioContext = () => new AudioContext()) {}
  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.silence();
  }
  silence() {
    this.generation++;
    for (const oscillator of this.active) {
      try {
        oscillator.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.active.clear();
  }
  /** Call only from user interaction, or its completed game move. No autoplay. */
  play(sound: Sound) {
    if (this.muted) return;
    try {
      const context = (this.context ??= this.create());
      const generation = this.generation;
      const schedule = () => {
        if (
          this.muted ||
          generation !== this.generation ||
          context.state !== "running"
        )
          return;
        const now = context.currentTime;
        if (sound !== "win" && now - this.lastSound < 0.045) return;
        this.lastSound = now;
        if (sound === "win") this.silence();
        let start = now + 0.005;
        const effect = notes[sound];
        for (const [frequency, duration] of effect.tones) {
          const oscillator = context.createOscillator(),
            gain = context.createGain();
          oscillator.type = "square";
          oscillator.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(effect.volume, start + 0.003);
          gain.gain.setValueAtTime(effect.volume, start + duration - 0.006);
          gain.gain.linearRampToValueAtTime(0, start + duration);
          oscillator.connect(gain);
          gain.connect(context.destination);
          this.active.add(oscillator);
          oscillator.onended = () => {
            this.active.delete(oscillator);
            oscillator.disconnect();
            gain.disconnect();
          };
          oscillator.start(start);
          oscillator.stop(start + duration + 0.005);
          start += duration + 0.025;
        }
      };
      if (context.state === "suspended")
        void context
          .resume()
          .then(schedule)
          .catch(() => {});
      else schedule();
    } catch {
      /* Audio unavailable: the puzzle remains fully playable. */
    }
  }
}
