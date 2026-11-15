import { LEVEL_PACK_ID, validLevelId } from "./pack";
export interface Best {
  bestMoves: number;
  bestPushes: number;
}
export interface Progress {
  version: 2;
  levelPackId: string;
  lastLevel: string;
  completed: Record<string, Best>;
  settings: Record<string, string | boolean | number>;
}
export const KEY = "box86.progress";
export const empty = (): Progress => ({
  version: 2,
  levelPackId: LEVEL_PACK_ID,
  lastLevel: "1",
  completed: {},
  settings: {},
});
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const count = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n > 0;
export function load(storage: Pick<Storage, "getItem">): Progress {
  const fresh = empty();
  try {
    const p: unknown = JSON.parse(storage.getItem(KEY) ?? "null");
    if (!object(p)) return fresh;
    // Preserve general primitive settings even when the pack or schema has changed.
    if (object(p.settings))
      for (const [key, value] of Object.entries(p.settings)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype")
          continue;
        if (
          typeof value === "boolean" ||
          typeof value === "string" ||
          (typeof value === "number" && Number.isFinite(value))
        )
          fresh.settings[key] = value;
      }
    if (p.version !== 2 || p.levelPackId !== LEVEL_PACK_ID) return fresh;
    if (validLevelId(p.lastLevel)) fresh.lastLevel = p.lastLevel;
    if (object(p.completed))
      for (const [id, entry] of Object.entries(p.completed)) {
        if (
          validLevelId(id) &&
          object(entry) &&
          count(entry.bestMoves) &&
          count(entry.bestPushes) &&
          entry.bestPushes <= entry.bestMoves
        ) {
          fresh.completed[id] = {
            bestMoves: entry.bestMoves,
            bestPushes: entry.bestPushes,
          };
        }
      }
    return fresh;
  } catch {
    return fresh;
  }
}
export function recordWin(
  p: Progress,
  id: string,
  moves: number,
  pushes: number,
) {
  if (!validLevelId(id) || !count(moves) || !count(pushes) || pushes > moves)
    throw Error("Invalid result");
  const old = p.completed[id];
  p.completed[id] = {
    bestMoves: Math.min(old?.bestMoves ?? Infinity, moves),
    bestPushes: Math.min(old?.bestPushes ?? Infinity, pushes),
  };
}
export function save(storage: Pick<Storage, "setItem">, p: Progress) {
  try {
    storage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
