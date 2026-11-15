import type { Level } from "./game";
import collection from "./levels.json";
// Frozen data only. Generator, solver, and quality reports are development tools.
export const levels: Level[] = collection;
