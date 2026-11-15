import "./style.css";
import { Game, parse, won } from "./game";
import { levels } from "./levels";
import { empty, load, save, recordWin } from "./storage";
import { render, type RenderFrame } from "./render";
import { Motion, swipeDirection } from "./motion";
import { RetroAudio } from "./audio";

type Screen = "menu" | "playing" | "levels" | "help";
const PAGE_SIZE = 10;
let progress = empty();
try {
  progress = load(localStorage);
} catch {
  /* Storage may be disabled. */
}
let index = Math.max(
  0,
  levels.findIndex((l) => l.id === progress.lastLevel),
);
let game = new Game(parse(levels[index].map));
let screen: Screen = "menu",
  returnScreen: Screen = "menu",
  started = false;
let page = Math.floor(index / PAGE_SIZE),
  storageAvailable = true;
const motion = new Motion(),
  audio = new RetroAudio();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const touchDefault =
  matchMedia("(pointer: coarse)").matches || innerWidth <= 800;
let showControls =
  typeof progress.settings.showControls === "boolean"
    ? progress.settings.showControls
    : touchDefault;
audio.setMuted(progress.settings.muted === true);
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="masthead">
    <a class="wordmark" href="#hauptmenue" id="home" aria-label="BOX 86 – Hauptmenü">BOX<span>//</span>86</a>
    <span class="system-name">MICROCOMPUTER PUZZLE SYSTEM</span>
    <div class="header-controls"><button id="mute" type="button"></button><button id="pause" type="button">PAUSE</button></div>
  </header>
  <main>
    <section class="intro">
      <div><p class="eyebrow">DISK 01 / 100 WAREHOUSE PUZZLES</p><h1>Kleine Kisten.<br>Große Kopfarbeit.</h1></div>
      <p class="intro-note">Ein Lager. Hundert Räume. Alles<br class="desktop-break"> an seinen Platz.</p>
    </section>
    <div class="play-layout">
      <section class="machine" aria-label="Spielkonsole">
        <div class="machine-inner"><div class="machine-content">
          <div class="status"><span id="level"></span><span>ZÜGE <b id="moves">000</b></span><span>SCHÜBE <b id="pushes">000</b></span></div>
          <div class="viewport"><canvas width="320" height="200" tabindex="0" role="img" aria-label="Sokoban Spielfeld" aria-describedby="game-hint"></canvas></div>
          <section id="menu-screen" class="menu-screen" aria-labelledby="menu-heading">
            <p class="menu-kicker">IBM-COMPATIBLE / CGA / PC SPEAKER</p>
            <h2 id="menu-heading">DEINE SCHICHT BEGINNT HIER.</h2>
            <p id="menu-room"></p>
            <nav class="menu-buttons" aria-label="Hauptmenü">
              <button id="start" type="button">SCHICHT BEGINNEN →</button>
              <button id="browse" type="button">RAUMVERZEICHNIS</button>
              <button id="help" type="button">SO WIRD GESCHOBEN</button>
            </nav>
            <p id="menu-summary" class="menu-summary"></p>
            <p class="menu-footnote">100 RÄUME. KEIN ZEITLIMIT. DEIN TEMPO.</p>
          </section>
          <div class="console-bottom" id="game-console">
            <div class="message" id="message" role="status"></div>
            <p id="personal-best" class="personal-best" hidden></p>
            <div class="toolbar">
              <button id="undo" type="button">Z · ZURÜCK</button>
              <button id="restart" type="button">R · NEUSTART</button>
              <button id="select" type="button">LEVELAUSWAHL</button>
              <button id="next" type="button" hidden>WEITER →</button>
            </div>
          </div>
        </div></div>
      </section>
      <aside class="touch-controls" aria-label="Bildschirmsteuerung" hidden>
        <div class="directions" aria-label="Bewegen">
          <button data-dir="0,-1" aria-label="Nach oben">↑</button>
          <button data-dir="-1,0" aria-label="Nach links">←</button>
          <button data-dir="0,1" aria-label="Nach unten">↓</button>
          <button data-dir="1,0" aria-label="Nach rechts">→</button>
        </div>
        <p>WISCHEN ODER TIPPEN</p>
      </aside>
    </div>
    <section id="levels" class="catalog" aria-labelledby="rooms-title" hidden>
      <div class="section-label"><h2 id="rooms-title">RAUMVERZEICHNIS</h2><span id="progress"></span></div>
      <p class="catalog-hint">Jeder Raum steht dir offen. ✓ = bereits geschafft.</p>
      <div class="level-pages" aria-label="Levelgruppen">
        <button id="previous-page" aria-label="Vorherige Levelgruppe">←</button>
        <label for="level-page">RÄUME</label><select id="level-page">${Array.from({ length: Math.ceil(levels.length / PAGE_SIZE) }, (_, i) => `<option value="${i}">${String(i * PAGE_SIZE + 1).padStart(2, "0")}–${Math.min(levels.length, (i + 1) * PAGE_SIZE)}</option>`).join("")}</select>
        <button id="following-page" aria-label="Nächste Levelgruppe">→</button>
      </div>
      <div class="levels"></div>
      <button id="close-levels" class="back-button">ESC · ZURÜCK</button>
    </section>
    <section id="help-screen" class="help-screen" aria-labelledby="help-heading" hidden>
      <p class="eyebrow">KURZE EINWEISUNG / LANGE FREUDE</p><h2 id="help-heading">ALLES AN SEINEN PLATZ.</h2>
      <p>Schiebe jede Kiste auf ein magentafarbenes Zielfeld. Kisten lassen sich einzeln schieben. Ziehen geht nicht.</p>
      <p>Auf dem richtigen Platz wird eine Kiste cyan und bekommt ein Häkchen. Eine Sackgasse erwischt? Mit Z geht jeder Zug zurück.</p>
      <dl class="key-guide"><dt>↑ ← ↓ → / WASD</dt><dd>Bewegen</dd><dt>Z</dt><dd>Unbegrenzt zurück</dd><dt>R</dt><dd>Raum neu starten</dd><dt>ESC / P</dt><dd>Pause / Hauptmenü</dd><dt>M</dt><dd>Ton an / aus</dd><dt>WISCHEN</dt><dd>Ein Zug in Wischrichtung</dd></dl>
      <p>Im Menü: Tab oder Pfeiltasten zum Auswählen, Enter zum Bestätigen. Im Raumverzeichnis: Pfeiltasten, Pos1/Ende und Bild ↑/↓.</p>
      <p>Bestwerte für Züge und Schübe werden getrennt gespeichert. Eine Pause behält deinen Versuch; nach einem Browser-Neustart beginnt der zuletzt gewählte Raum von vorn.</p>
      <button id="close-help" class="back-button">ESC · ZURÜCK</button>
    </section>
    <div class="options" aria-label="Einstellungen">
      <label class="crt-option"><input id="scanlines" type="checkbox"> CRT-SCANLINES</label>
      <label class="crt-option"><input id="show-controls" type="checkbox"> STEUERKREUZ</label>
      <span id="motion-note" hidden>BEWEGUNG REDUZIERT</span>
    </div>
    <p id="storage-note" class="storage-note" role="status" hidden>Speichern ist hier nicht verfügbar. Du kannst für diese Sitzung weiterspielen.</p>
    <footer><span id="game-hint">↑ ← ↓ → / WASD · BEWEGEN<br>Z · UNDO &nbsp; R · NEUSTART &nbsp; ESC · PAUSE</span><span class="footer-note">KEIN ZEITDRUCK.<br>NUR DU & DIE KISTEN.</span><span>BOX//86 · RELEASE 1.0</span></footer>
  </main>`;
const el = (id: string) => document.getElementById(id)!;
const button = (id: string) => el(id) as HTMLButtonElement;
const canvas = document.querySelector("canvas")!;
const scanlines = el("scanlines") as HTMLInputElement;
const controlsOption = el("show-controls") as HTMLInputElement;
scanlines.checked = progress.settings.scanlines === true;
controlsOption.checked = showControls;

function persist() {
  try {
    storageAvailable = save(localStorage, progress);
  } catch {
    storageAvailable = false;
  }
  el("storage-note").hidden = storageAvailable;
}
let activeFrame: RenderFrame = {};
function paint(frame: RenderFrame = motion.busy ? activeFrame : {}) {
  activeFrame = frame;
  if (screen === "menu" || screen === "playing")
    render(canvas, game, screen === "menu", frame);
}
function catalog() {
  (el("level-page") as HTMLSelectElement).value = String(page);
  button("previous-page").disabled = page === 0;
  button("following-page").disabled = (page + 1) * PAGE_SIZE >= levels.length;
  document.querySelector(".levels")!.innerHTML = levels
    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    .map((l, offset) => {
      const i = page * PAGE_SIZE + offset,
        best = progress.completed[l.id];
      return `<button data-level="${i}" class="${i === index ? "active" : ""}" aria-label="Raum ${i + 1}: ${l.name}${best ? ", abgeschlossen" : ""}" title="${best ? `${best.bestMoves} Züge / ${best.bestPushes} Schübe (getrennte Bestwerte)` : l.name}" aria-pressed="${i === index}"><span>${String(i + 1).padStart(2, "0")}</span><small>${l.name}</small><b aria-hidden="true">${best ? "✓" : "·"}</b></button>`;
    })
    .join("");
}
function draw(frame?: RenderFrame) {
  app.dataset.screen = screen;
  app.dataset.won = String(won(game.board, game.state));
  app.dataset.busy = String(motion.busy);
  document.querySelector<HTMLElement>(".play-layout")!.hidden =
    screen === "levels" || screen === "help";
  el("menu-screen").hidden = screen !== "menu";
  el("game-console").hidden = screen !== "playing";
  document.querySelector<HTMLElement>(".status")!.hidden = screen !== "playing";
  document.querySelector<HTMLElement>(".touch-controls")!.hidden =
    screen !== "playing" || !showControls;
  el("levels").hidden = screen !== "levels";
  el("help-screen").hidden = screen !== "help";
  button("pause").hidden = screen !== "playing";
  el("level").textContent =
    `RAUM ${String(index + 1).padStart(2, "0")} / ${levels.length}`;
  el("moves").textContent = String(game.state.moves).padStart(3, "0");
  el("pushes").textContent = String(game.state.pushes).padStart(3, "0");
  canvas.setAttribute(
    "aria-label",
    `Sokoban Spielfeld – Raum ${index + 1}: ${levels[index].name}`,
  );
  const completed = Object.keys(progress.completed).length,
    personal = progress.completed[levels[index].id],
    finished = won(game.board, game.state);
  el("message").textContent = finished
    ? index === levels.length - 1
      ? "FEIERABEND! Auch dieser Raum ist geschafft."
      : "RAUM GESCHAFFT! Gute Arbeit, weiter geht’s →"
    : levels[index].name + " · Alle Kisten auf die Ziele.";
  el("personal-best").hidden = !personal;
  el("personal-best").textContent = personal
    ? `BESTWERTE: ${personal.bestMoves} ZÜGE / ${personal.bestPushes} SCHÜBE (GETRENNT)`
    : "";
  button("undo").disabled = motion.busy || game.history.length === 0;
  button("restart").disabled = motion.busy;
  button("select").disabled = motion.busy;
  button("next").hidden = !finished || index === levels.length - 1;
  button("next").disabled = motion.busy;
  document
    .querySelectorAll<HTMLButtonElement>("[data-dir]")
    .forEach((b) => (b.disabled = motion.busy || finished));
  el("menu-heading").textContent = started
    ? "PAUSE. DEIN LAGER WARTET."
    : "DEINE SCHICHT BEGINNT HIER.";
  button("start").textContent = started
    ? "WEITERSPIELEN →"
    : "SCHICHT BEGINNEN →";
  el("menu-room").textContent =
    `RAUM ${String(index + 1).padStart(2, "0")} / ${levels[index].name}`;
  el("menu-summary").textContent = `${completed} / 100 RÄUME GESCHAFFT`;
  el("progress").textContent = `${completed} / 100 ERLEDIGT`;
  button("mute").textContent = audio.muted ? "TON: AUS" : "TON: AN";
  button("mute").setAttribute(
    "aria-label",
    audio.muted ? "Ton einschalten (M)" : "Ton stummschalten (M)",
  );
  button("mute").setAttribute("aria-pressed", String(audio.muted));
  el("motion-note").hidden = !reducedMotion.matches;
  if (screen === "levels") catalog();
  paint(frame);
}
function show(next: Screen, focus = true) {
  motion.cancel();
  screen = next;
  draw();
  window.scrollTo(0, 0);
  if (focus) {
    const target =
      next === "playing"
        ? canvas
        : next === "menu"
          ? el("start")
          : next === "levels"
            ? (document.querySelector<HTMLElement>(`[data-level="${index}"]`) ??
              el("level-page"))
            : el("close-help");
    target.focus({ preventScroll: true });
  }
}
async function transition() {
  const task = motion.run(reducedMotion.matches ? 0 : 160, (p) =>
    paint({ transition: p }),
  );
  draw({ transition: reducedMotion.matches ? 1 : 0 });
  const completed = await task;
  if (completed && screen === "playing") draw();
}
function choose(i: number) {
  if (!Number.isInteger(i) || i < 0 || i >= levels.length) return;
  motion.cancel();
  index = i;
  page = Math.floor(index / PAGE_SIZE);
  game = new Game(parse(levels[i].map));
  started = true;
  progress.lastLevel = levels[i].id;
  show("playing");
  persist();
  void transition();
}
function openLevels() {
  returnScreen = screen === "playing" ? "playing" : "menu";
  page = Math.floor(index / PAGE_SIZE);
  show("levels");
}
async function step(dx: number, dy: number) {
  if (screen !== "playing" || motion.busy || won(game.board, game.state))
    return;
  const currentGame = game;
  const before = game.state;
  game.step(dx, dy);
  if (before === game.state) return;
  const pushed = game.state.pushes > before.pushes,
    finished = won(game.board, game.state);
  audio.play(pushed ? "push" : "walk");
  if (finished) {
    recordWin(progress, levels[index].id, game.state.moves, game.state.pushes);
    persist();
  }
  const move = motion.run(reducedMotion.matches ? 0 : pushed ? 120 : 90, (p) =>
    paint({ previous: before, progress: p }),
  );
  draw({ previous: before, progress: reducedMotion.matches ? 1 : 0 }); // Frames update only the artwork.
  const completed = await move;
  if (!completed || screen !== "playing" || game !== currentGame) return;
  if (finished) {
    audio.play("win");
    const celebration = motion.run(reducedMotion.matches ? 0 : 360, (p) =>
      paint({ celebration: p }),
    );
    draw({ celebration: 0 });
    if (!(await celebration)) return;
  }
  if (screen === "playing" && game === currentGame) draw();
}
function undo() {
  if (screen !== "playing" || motion.busy) return;
  game.undo();
  draw();
}
function restart() {
  if (screen !== "playing" || motion.busy) return;
  game.restart();
  draw();
}
function mute() {
  audio.setMuted(!audio.muted);
  progress.settings.muted = audio.muted;
  persist();
  draw();
  if (!audio.muted) audio.play("menu");
}

app.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!target || target.disabled) return;
  if (target.dataset.dir) {
    const [x, y] = target.dataset.dir.split(",").map(Number);
    void step(x, y);
    return;
  }
  if (target.id === "mute") {
    mute();
    return;
  }
  audio.play("menu");
  if (target.dataset.level) {
    choose(Number(target.dataset.level));
    return;
  }
  switch (target.id) {
    case "start":
      started = true;
      show("playing");
      void transition();
      break;
    case "pause":
      show("menu");
      break;
    case "browse":
    case "select":
      openLevels();
      break;
    case "help":
      returnScreen = "menu";
      show("help");
      break;
    case "close-help":
    case "close-levels":
      show(returnScreen);
      break;
    case "undo":
      undo();
      break;
    case "restart":
      restart();
      break;
    case "next":
      choose(index + 1);
      break;
    case "previous-page":
      if (page > 0) {
        page--;
        catalog();
      }
      break;
    case "following-page":
      if ((page + 1) * PAGE_SIZE < levels.length) {
        page++;
        catalog();
      }
      break;
  }
});
el("home").onclick = (e) => {
  e.preventDefault();
  audio.play("menu");
  show("menu");
};
(el("level-page") as HTMLSelectElement).onchange = (e) => {
  page = Number((e.target as HTMLSelectElement).value);
  audio.play("menu");
  catalog();
};
scanlines.onchange = () => {
  progress.settings.scanlines = scanlines.checked;
  audio.play("menu");
  persist();
};
controlsOption.onchange = () => {
  showControls = controlsOption.checked;
  progress.settings.showControls = showControls;
  audio.play("menu");
  persist();
  draw();
};

const keys: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  w: [0, -1],
  ArrowDown: [0, 1],
  s: [0, 1],
  ArrowLeft: [-1, 0],
  a: [-1, 0],
  ArrowRight: [1, 0],
  d: [1, 0],
};
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.target instanceof HTMLSelectElement && key !== "Escape") return;
  if (key === "m") {
    e.preventDefault();
    if (!e.repeat) mute();
    return;
  }
  if (key === "Escape" || key === "p") {
    e.preventDefault();
    if (e.repeat) return;
    audio.play("menu");
    if (screen === "playing") show("menu");
    else if (screen === "levels" || screen === "help") show(returnScreen);
    else if (started) {
      show("playing");
      void transition();
    }
    return;
  }
  if (screen === "playing") {
    if (keys[key]) {
      e.preventDefault();
      void step(...keys[key]);
    } else if (key === "z" || key === "r") {
      e.preventDefault();
      if (!e.repeat) {
        audio.play("menu");
        if (key === "z") undo();
        else restart();
      }
    }
    return;
  }
  if (screen === "menu" && (key === "ArrowDown" || key === "ArrowUp")) {
    e.preventDefault();
    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".menu-buttons button"),
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement),
      delta = key === "ArrowDown" ? 1 : -1;
    items[
      current < 0
        ? delta > 0
          ? 0
          : items.length - 1
        : (current + delta + items.length) % items.length
    ].focus();
    audio.play("menu");
  }
  if (screen === "levels") {
    const items = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[data-level]"),
      ),
      current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (key === "PageDown" || key === "PageUp") {
      e.preventDefault();
      page = Math.max(
        0,
        Math.min(
          Math.ceil(levels.length / PAGE_SIZE) - 1,
          page + (key === "PageDown" ? 1 : -1),
        ),
      );
      catalog();
      document.querySelector<HTMLButtonElement>("[data-level]")!.focus();
      audio.play("menu");
      return;
    }
    if (current < 0) return;
    const cols = innerWidth <= 600 ? 2 : 5;
    const delta: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -cols,
      ArrowDown: cols,
      Home: -current,
      End: items.length - 1 - current,
    };
    if (key in delta) {
      e.preventDefault();
      items[
        Math.max(0, Math.min(items.length - 1, current + delta[key]))
      ].focus();
      audio.play("menu");
    }
  }
});

let gesture: { id: number; x: number; y: number } | null = null;
canvas.addEventListener("pointerdown", (e) => {
  if (!e.isPrimary) {
    gesture = null;
    return;
  }
  if (screen !== "playing" || motion.busy || e.button !== 0) return;
  e.preventDefault();
  canvas.focus({ preventScroll: true });
  gesture = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", (e) => {
  if (!gesture || gesture.id !== e.pointerId) return;
  const direction = swipeDirection(
    e.clientX - gesture.x,
    e.clientY - gesture.y,
  );
  gesture = null;
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  if (direction) void step(...direction);
});
canvas.addEventListener("pointercancel", () => {
  gesture = null;
});
canvas.addEventListener("lostpointercapture", () => {
  gesture = null;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.silence();
    if (screen === "playing") show("menu", false);
  }
});
reducedMotion.addEventListener("change", () => {
  motion.cancel();
  draw();
});
new ResizeObserver(() => paint()).observe(document.querySelector(".viewport")!);
window.addEventListener("resize", () => {
  if (typeof progress.settings.showControls !== "boolean") {
    showControls = matchMedia("(pointer: coarse)").matches || innerWidth <= 800;
    controlsOption.checked = showControls;
    draw();
  } else paint();
});
void document.fonts.ready.then(() => paint());
draw();
persist();
