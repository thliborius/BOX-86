import "./style.css";
import { Game, parse, won } from "./game";
import { levels } from "./levels";
import { empty, load, save, recordWin } from "./storage";
import { render } from "./render";
let progress = empty();
try {
  progress = load(localStorage);
} catch {
  /* Storage may be disabled. */
}
let index = Math.max(
    0,
    levels.findIndex((l) => l.id === progress.lastLevel),
  ),
  game = new Game(parse(levels[index].map)),
  title = true;
const PAGE_SIZE = 10;
let page = Math.floor(index / PAGE_SIZE);
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="masthead">
    <a class="wordmark" href="." aria-label="BOX 86 Startseite">BOX<span>//</span>86</a>
    <span class="system-name">MICROCOMPUTER PUZZLE SYSTEM</span>
    <b class="edition">● CGA EDITION</b>
  </header>
  <main>
    <section class="intro">
      <div><p class="eyebrow">DISK 01 / 100 WAREHOUSE PUZZLES</p>
        <h1>Kleine Kisten.<br>Große Kopfarbeit.</h1>
      </div>
      <p class="intro-note">Ein Lager. Hundert Räume. Alles<br class="desktop-break"> an seinen Platz.</p>
    </section>
    <section class="machine" aria-label="Spielkonsole">
      <div class="machine-inner"><div class="machine-content">
        <div class="status">
          <span id="level"></span>
          <span>ZÜGE <b id="moves">000</b></span>
          <span>SCHÜBE <b id="pushes">000</b></span>
        </div>
        <div class="viewport"><canvas width="320" height="200" aria-label="Sokoban Spielfeld"></canvas></div>
        <div class="console-bottom">
          <div class="message" id="message" role="status"></div>
          <p id="personal-best" class="personal-best" hidden></p>
          <div class="toolbar">
            <button id="start">SCHICHT BEGINNEN →</button>
            <button id="undo">Z · ZURÜCK</button>
            <button id="restart">R · NEUSTART</button>
            <button id="select">LEVELAUSWAHL</button>
            <button id="next" hidden>WEITER →</button>
          </div>
        </div>
      </div></div>
    </section>
    <section id="levels" aria-labelledby="rooms-title">
      <div class="section-label"><h2 id="rooms-title">RAUMVERZEICHNIS</h2><span id="progress"></span></div>
      <div class="level-pages" aria-label="Levelgruppen">
        <button id="previous-page" aria-label="Vorherige Levelgruppe">←</button>
        <label for="level-page">RÄUME</label><select id="level-page">${Array.from({ length: Math.ceil(levels.length / PAGE_SIZE) }, (_, i) => `<option value="${i}">${String(i * PAGE_SIZE + 1).padStart(2, "0")}–${Math.min(levels.length, (i + 1) * PAGE_SIZE)}</option>`).join("")}</select>
        <button id="following-page" aria-label="Nächste Levelgruppe">→</button>
      </div>
      <div class="levels"></div>
    </section>
    <div class="directions" aria-label="Bewegen">
      <button data-dir="0,-1" aria-label="Nach oben">↑</button>
      <button data-dir="-1,0" aria-label="Nach links">←</button>
      <button data-dir="0,1" aria-label="Nach unten">↓</button>
      <button data-dir="1,0" aria-label="Nach rechts">→</button>
    </div>
    <footer><span>↑ ← ↓ → / WASD · BEWEGEN<br>Z · UNDO &nbsp; R · NEUSTART</span>
      <span class="footer-note">KEIN ZEITDRUCK.<br>NUR DU & DIE KISTEN.</span>
      <label class="crt-option"><input id="scanlines" type="checkbox"> CRT-SCANLINES</label>
    </footer>
  </main>`;
const el = (id: string) => document.getElementById(id)!;
const canvas = document.querySelector("canvas")!;
function persist() {
  try {
    if (!save(localStorage, progress))
      el("message").textContent += " Fortschritt nur für diese Sitzung.";
  } catch {
    el("message").textContent += " Fortschritt nur für diese Sitzung.";
  }
}
function draw() {
  render(canvas, game, title);
  el("level").textContent =
    `RAUM ${String(index + 1).padStart(2, "0")} / ${levels.length}`;
  el("moves").textContent = String(game.state.moves).padStart(3, "0");
  el("pushes").textContent = String(game.state.pushes).padStart(3, "0");
  el("message").textContent = title
    ? "BEREIT FÜR DEINE ERSTE SCHICHT?"
    : won(game.board, game.state)
      ? index === levels.length - 1
        ? "FEIERABEND! Alle Kisten dieses Raums sind verstaut."
        : "RAUM GESCHAFFT! Weiter zur nächsten Schicht →"
      : levels[index].name +
        " · Schiebe jede Kiste auf ein magentafarbenes Ziel.";
  const personal = progress.completed[levels[index].id];
  el("personal-best").hidden = !personal;
  el("personal-best").textContent = personal
    ? `BESTWERTE: ${personal.bestMoves} ZÜGE / ${personal.bestPushes} SCHÜBE (GETRENNTE MINIMA)`
    : "";
  el("start").hidden = !title;
  el("next").hidden =
    title || !won(game.board, game.state) || index === levels.length - 1;
  el("progress").textContent =
    `${levels.filter((l) => progress.completed[l.id]).length} / ${levels.length} ERLEDIGT`;
  (el("level-page") as HTMLSelectElement).value = String(page);
  (el("previous-page") as HTMLButtonElement).disabled = page === 0;
  (el("following-page") as HTMLButtonElement).disabled =
    (page + 1) * PAGE_SIZE >= levels.length;
  document.querySelector(".levels")!.innerHTML = levels
    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    .map((l, offset) => {
      const i = page * PAGE_SIZE + offset;
      const best = progress.completed[l.id];
      return `<button data-level="${i}" class="${i === index ? "active" : ""} ${progress.completed[l.id] ? "completed" : ""}" aria-label="Raum ${i + 1}: ${l.name}${progress.completed[l.id] ? ", abgeschlossen" : ""}" title="${best ? `Bestwerte: ${best.bestMoves} Züge / ${best.bestPushes} Schübe (getrennte Minima)` : l.name}" aria-pressed="${i === index}"><span>${String(i + 1).padStart(2, "0")}</span><small>${l.name}</small><b aria-hidden="true">${progress.completed[l.id] ? "✓" : "·"}</b></button>`;
    })
    .join("");
}
function choose(i: number) {
  index = i;
  page = Math.floor(index / PAGE_SIZE);
  title = false;
  game = new Game(parse(levels[i].map));
  progress.lastLevel = levels[i].id;
  draw();
  persist();
}
function step(dx: number, dy: number) {
  if (title || won(game.board, game.state)) return;
  game.step(dx, dy);
  if (won(game.board, game.state)) {
    recordWin(progress, levels[index].id, game.state.moves, game.state.pushes);
    draw();
    persist();
  } else draw();
}
(el("level-page") as HTMLSelectElement).onchange = (e) => {
  page = Number((e.target as HTMLSelectElement).value);
  draw();
};
el("previous-page").onclick = () => {
  if (page > 0) {
    page--;
    draw();
  }
};
el("following-page").onclick = () => {
  if ((page + 1) * PAGE_SIZE < levels.length) {
    page++;
    draw();
  }
};
const scanlines = el("scanlines") as HTMLInputElement;
scanlines.checked = progress.settings.scanlines === true;
scanlines.onchange = () => {
  progress.settings.scanlines = scanlines.checked;
  persist();
};
el("start").onclick = () => choose(index);
el("undo").onclick = () => {
  game.undo();
  draw();
};
el("restart").onclick = () => {
  game.restart();
  draw();
};
el("select").onclick = () => {
  page = Math.floor(index / PAGE_SIZE);
  draw();
  el("levels").scrollIntoView({ behavior: "smooth" });
  document.querySelector<HTMLButtonElement>("[data-level]")!.focus();
};
el("next").onclick = () => choose(index + 1);
app.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("button");
  if (t?.dataset.level) choose(Number(t.dataset.level));
  if (t?.dataset.dir) {
    const [x, y] = t.dataset.dir.split(",").map(Number);
    step(x, y);
  }
});
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
  if (e.target instanceof HTMLSelectElement) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (keys[k]) {
    e.preventDefault();
    step(...keys[k]);
  } else if (k === "z") {
    game.undo();
    draw();
  } else if (k === "r") {
    game.restart();
    draw();
  }
});
draw();
persist(); // Durably write pack migrations even before the first move.

// Layout changes only redraw the artwork; game state and progress remain untouched.
new ResizeObserver(() => render(canvas, game, title)).observe(
  document.querySelector(".viewport")!,
);
void document.fonts.ready.then(() => render(canvas, game, title));
