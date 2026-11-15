import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const report = JSON.parse(
  readFileSync(new URL("../data/level-quality.json", import.meta.url), "utf8"),
) as { levels: { solution: string }[] };
import { LEVEL_PACK_ID } from "../src/pack";

async function ready(page: Page) {
  await expect(page.locator("#app")).toHaveAttribute("data-busy", "false");
}
async function start(page: Page) {
  await page.locator("#start").click();
  await ready(page);
}
async function choose(page: Page, id: number) {
  await page
    .locator("#level-page")
    .selectOption(String(Math.floor((id - 1) / 10)));
  await page.getByRole("button", { name: new RegExp(`Raum ${id}:`) }).click();
  await ready(page);
}
const direction: Record<string, string> = {
  U: "ArrowUp",
  R: "ArrowRight",
  D: "ArrowDown",
  L: "ArrowLeft",
};

test("preserves results, menus, settings and last room across reloads", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Count actual AudioContext construction: opening the page must not activate audio.
  await page.addInitScript(() => {
    const original = window.AudioContext;
    let calls = 0;
    Object.defineProperty(window, "__audioCreated", { get: () => calls });
    window.AudioContext = new Proxy(original, {
      construct(target, args) {
        calls++;
        return Reflect.construct(target, args);
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "menu");
  expect(await page.evaluate(() => Reflect.get(window, "__audioCreated"))).toBe(
    0,
  );
  await page.evaluate(
    (pack) =>
      localStorage.setItem(
        "box86.progress",
        JSON.stringify({
          version: 2,
          levelPackId: pack,
          lastLevel: "53",
          completed: { "1": { bestMoves: 7, bestPushes: 3 } },
          settings: { muted: true, scanlines: true, showControls: false },
        }),
      ),
    LEVEL_PACK_ID,
  );
  await page.reload();
  await expect(page.locator("#mute")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#scanlines")).toBeChecked();
  await expect(page.locator("#menu-summary")).toContainText("1 / 100");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#start")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#browse")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#levels")).toBeVisible();
  await page.keyboard.press("Home");
  await expect(page.locator('[data-level="50"]')).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.locator('[data-level="59"]')).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect(page.locator('[data-level="60"]')).toBeFocused();
  await choose(page, 100);
  await expect(page.locator("#level")).toContainText("100 / 100");
  await page.keyboard.press("Escape");
  await expect(page.locator("#app")).toHaveAttribute("data-screen", "menu");
  await page.locator("#help").click();
  await expect(page.locator("#help-screen")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await start(page);
  await expect(page.locator("#level")).toContainText("100 / 100");
  await page.locator("#select").click();
  await choose(page, 1);
  await page.keyboard.press("ArrowDown");
  await ready(page);
  await expect(page.locator("#moves")).toHaveText("001");
  await page.keyboard.press("Escape");
  await start(page);
  await expect(page.locator("#moves")).toHaveText("001");
  await page.keyboard.press("z");
  await expect(page.locator("#moves")).toHaveText("000");
  await page.keyboard.press("ArrowDown");
  await ready(page);
  await page.locator("#restart").click();
  await expect(page.locator("#moves")).toHaveText("000");
  for (const letter of report.levels[0].solution!) {
    await page.keyboard.press(direction[letter]);
    await ready(page);
  }
  await expect(page.locator("#message")).toContainText("RAUM GESCHAFFT");
  await expect(page.locator("#personal-best")).toContainText(
    "7 ZÜGE / 3 SCHÜBE",
  );
  await page.locator("#next").click();
  await ready(page);
  await expect(page.locator("#level")).toContainText("02 / 100");
  await page.reload();
  await expect(page.locator("#menu-room")).toContainText("RAUM 02");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("box86.progress")!).completed["1"],
    ),
  ).toEqual({ bestMoves: 7, bestPushes: 3 });
  expect(await page.evaluate(() => Reflect.get(window, "__audioCreated"))).toBe(
    0,
  ); // Still muted.
  await page.locator("#mute").click();
  await expect(page.locator("#mute")).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => Reflect.get(window, "__audioCreated"))).toBe(
    1,
  );
  await page.locator("#mute").click();
  await page.reload();
  await expect(page.locator("#mute")).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("locks overlapping input, honors reduced motion, and handles swipes without scrolling", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.locator("#browse").click();
  await choose(page, 1);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  });
  await expect(page.locator("#moves")).toHaveText("001");
  await ready(page);
  await page.keyboard.press("Escape");
  await start(page);
  await expect(page.locator("#moves")).toHaveText("001");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#restart").click();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#app")).toHaveAttribute("data-busy", "false");
  await page.locator("#restart").click();
  const before = await page.evaluate(() => scrollY);
  const bounds = (await page.locator("canvas").boundingBox())!;
  const x = bounds.x + bounds.width / 2,
    y = bounds.y + bounds.height / 2;
  if (testInfo.project.name === "phone") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + 50 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 50);
    await page.mouse.up();
  }
  await expect(page.locator("#moves")).toHaveText("001");
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await expect(page.locator("canvas")).toHaveCSS("touch-action", "none");
  await page.locator("#show-controls").check();
  await expect(
    page.getByRole("button", { name: "Nach oben", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".touch-controls .directions")).toHaveCSS("touch-action", "none");
  // Settings checkboxes must not swallow subsequent game keyboard input.
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#moves")).toHaveText("002");
  await page.keyboard.press("ArrowDown");
  await page.getByRole("button", { name: "Nach oben", exact: true }).click();
  await expect(page.locator("#moves")).toHaveText("004");
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const c = document.querySelector("canvas")!;
      return c.clientWidth / c.width >= 1;
    });
    const layout = await page.evaluate(() => {
      const c = document.querySelector("canvas")!;
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        scale: c.clientWidth / c.width,
        smoothing: c.getContext("2d")!.imageSmoothingEnabled,
      };
    });
    expect(layout.overflow).toBe(false);
    expect(Number.isInteger(layout.scale)).toBe(true);
    expect(layout.smoothing).toBe(false);
  }
});

test("loads the static bundle, font and controls from a hosting subdirectory", async ({
  page,
}) => {
  const types: Record<string, string> = {
    html: "text/html",
    js: "text/javascript",
    css: "text/css",
    ttf: "font/ttf",
    svg: "image/svg+xml",
  };
  await page.route("**/box86-static/**", async (route) => {
    const relative =
      new URL(route.request().url()).pathname.split("/box86-static/")[1] ||
      "index.html";
    const body = readFileSync(new URL("../dist/" + relative, import.meta.url));
    await route.fulfill({
      body,
      contentType:
        types[relative.split(".").at(-1)!] ?? "application/octet-stream",
    });
  });
  await page.goto("/box86-static/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#menu-screen")).toBeVisible();
  expect(
    await page.evaluate(() => document.fonts.check('20px "BOX86 Pixel"')),
  ).toBe(true);
  await start(page);
  await expect(page.locator("canvas")).toBeVisible();
});
