import type { Game } from "./game";

const CYAN = "#55ffff";
const MAGENTA = "#ff55ff";
const WHITE = "#ffffff";
const BLACK = "#000000";
const TILE = 16;

/** Integer coordinates and a four-color palette throughout the artwork. */
export function render(canvas: HTMLCanvasElement, game: Game, title: boolean) {
  const board = game.board;
  const available = Math.floor(canvas.parentElement!.clientWidth);
  // Compact on phones, breathing room on desktop. Always scale by whole pixels.
  const minimumWidth = board.width * TILE + 8;
  const desiredWidth =
    available <= 600
      ? Math.max(title ? 232 : 0, minimumWidth)
      : Math.max(256, minimumWidth);
  const scale = Math.max(1, Math.floor(available / desiredWidth));
  const width = Math.max(minimumWidth, Math.floor(available / scale));
  const height = Math.max(title ? 136 : 112, board.height * TILE + 24);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width * scale}px`;
  canvas.style.height = `${height * scale}px`;
  canvas.style.marginLeft = `${Math.max(0, Math.floor((available - width * scale) / 2))}px`;

  const c = canvas.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  const dither = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    sparse = false,
  ) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if ((i + j) % 2 === 0 && (!sparse || (i + j * 3) % 4 === 0)) {
          rect(x + i, y + j, 1, 1, color);
        }
      }
    }
  };
  const outline = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) => {
    rect(x, y, w, 1, color);
    rect(x, y + h - 1, w, 1, color);
    rect(x, y, 1, h, color);
    rect(x + w - 1, y, 1, h, color);
  };
  const ox = Math.floor((width - board.width * TILE) / 2);
  const oy = Math.floor((height - board.height * TILE) / 2) - 2;
  rect(0, 0, width, height, BLACK);

  // Stippled shadows sit behind walls and actors.
  for (const p of board.walls) {
    dither(
      ox + (p % board.width) * TILE + 3,
      oy + Math.floor(p / board.width) * TILE + 3,
      TILE,
      TILE,
      CYAN,
      true,
    );
  }
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const p = y * board.width + x;
      const X = ox + x * TILE;
      const Y = oy + y * TILE;
      rect(X, Y, TILE, TILE, BLACK);
      if (board.walls.has(p)) {
        // Staggered brick courses continue across tile seams.
        for (let row = 0; row < 2; row++) {
          const offset = row === 0 ? 0 : -8;
          for (let start = offset; start < TILE; start += TILE) {
            const left = Math.max(0, start);
            const right = Math.min(TILE - 1, start + TILE - 2);
            const w = right - left + 1;
            const yy = Y + row * 8;
            rect(X + left, yy + 1, w, 6, CYAN);
            rect(X + left, yy + 1, w, 1, WHITE);
            if (start >= 0) rect(X + left, yy + 2, 1, 2, WHITE);
            dither(X + left, yy + 5, w, 2, BLACK);
            if (w > 5) rect(X + left + 3, yy + 3, 1, 1, WHITE);
          }
        }
        continue;
      }
      if (!board.floors.has(p)) continue;
      rect(X + 4, Y + 5, 1, 1, CYAN);
      if ((x + y) % 2 === 0) rect(X + 12, Y + 13, 1, 1, CYAN);
      if (board.goals.has(p)) {
        outline(X + 3, Y + 3, 10, 10, MAGENTA);
        outline(X + 5, Y + 5, 6, 6, MAGENTA);
        rect(X + 7, Y + 7, 2, 2, WHITE);
      }
    }
  }
  for (const p of game.state.boxes) {
    const X = ox + (p % board.width) * TILE;
    const Y = oy + Math.floor(p / board.width) * TILE;
    const placed = board.goals.has(p);
    const color = placed ? CYAN : MAGENTA;
    rect(X + 1, Y + 1, 14, 14, BLACK);
    dither(X + 3, Y + 15, 12, 2, color);
    outline(X + 1, Y + 1, 14, 13, color);
    rect(X + 2, Y + 2, 12, 1, WHITE);
    rect(X + 2, Y + 3, 1, 9, WHITE);
    outline(X + 4, Y + 4, 8, 7, color);
    // Cross-braces, bright leading edges, and four corner rivets.
    for (let i = 0; i < 8; i++) {
      rect(X + 4 + i, Y + 4 + i, 2, 1, color);
      rect(X + 11 - i, Y + 4 + i, 1, 1, WHITE);
    }
    for (const [dx, dy] of [
      [3, 3],
      [12, 3],
      [3, 12],
      [12, 12],
    ]) {
      rect(X + dx, Y + dy, 1, 1, WHITE);
    }
    if (placed) {
      rect(X + 4, Y + 4, 8, 7, BLACK);
      rect(X + 5, Y + 7, 2, 2, WHITE);
      rect(X + 6, Y + 8, 2, 2, WHITE);
      for (let i = 0; i < 5; i++) {
        rect(X + 7 + i, Y + 9 - i, 1, 2, WHITE);
      }
    }
  }

  const X = ox + (game.state.player % board.width) * TILE;
  const Y = oy + Math.floor(game.state.player / board.width) * TILE;
  rect(X + 3, Y + 15, 11, 1, BLACK);
  dither(X + 4, Y + 16, 9, 1, CYAN);
  rect(X + 5, Y + 1, 7, 3, MAGENTA); // Cap and brim.
  rect(X + 6, Y, 5, 1, MAGENTA);
  rect(X + 6, Y + 1, 3, 1, WHITE);
  rect(X + 3, Y + 4, 11, 1, MAGENTA);
  rect(X + 5, Y + 5, 7, 5, WHITE);
  rect(X + 6, Y + 6, 1, 2, BLACK);
  rect(X + 10, Y + 6, 1, 2, BLACK);
  rect(X + 8, Y + 9, 2, 1, BLACK);
  rect(X + 4, Y + 10, 9, 4, CYAN); // Overalls, cuffs and boots.
  rect(X + 6, Y + 10, 1, 2, WHITE);
  rect(X + 10, Y + 10, 1, 2, WHITE);
  rect(X + 2, Y + 10, 2, 3, WHITE);
  rect(X + 13, Y + 10, 2, 3, WHITE);
  rect(X + 4, Y + 14, 3, 2, WHITE);
  rect(X + 10, Y + 14, 3, 2, WHITE);

  if (title) {
    const center = Math.floor(width / 2);
    const left = Math.floor((width - 216) / 2);
    const top = Math.floor((height - 86) / 2);
    rect(left - 3, top - 3, 222, 92, BLACK);
    outline(left, top, 216, 86, CYAN);
    dither(left + 3, top + 3, 210, 4, MAGENTA, true);
    c.textAlign = "center";
    c.font = '40px "BOX86 Pixel", monospace';
    c.fillStyle = MAGENTA;
    c.fillText("BOX//86", center + 1, top + 43);
    c.fillStyle = WHITE;
    c.fillText("BOX//86", center, top + 42);
    c.font = '10px "BOX86 Pixel", monospace';
    c.fillStyle = CYAN;
    c.fillText("WAREHOUSE SHIFT / EST. 1987", center, top + 61);
    c.fillStyle = WHITE;
    c.fillText("100 ROOMS. ONE LITTLE HERO.", center, top + 76);
  }
}
