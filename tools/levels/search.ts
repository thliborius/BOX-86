import { writeFileSync, mkdirSync } from "node:fs";
import { parse } from "../../src/game";
import { candidate } from "./generator";
import { solve } from "./solver";
import { analyze, isInteresting } from "./quality";
import { canonical, geometrySimilarity } from "./duplicates";
import { verify } from "./verify";
import { tutorials } from "./tutorial";

const pool: unknown[] = [],
  seen = new Set(tutorials.map((t) => canonical(t.map, true)));
let attempts = 0,
  limits = 0,
  detours = 0;
mkdirSync("tmp", { recursive: true });
for (let seed = 870001; seed < 910001 && detours < 140; seed++) {
  attempts++;
  const count = 2 + (seed % 4),
    c = candidate(seed, count);
  if (!c) continue;
  const geometry = canonical(c.map, true);
  if (seen.has(geometry)) continue;
  // Reject near-identical floor masks even before spending solver time.
  if (
    (pool as { map: string }[]).some(
      (p) => geometrySimilarity(p.map, c.map) > 0.93,
    )
  )
    continue;
  const result = solve(parse(c.map), { maxStates: 22_000, maxMs: 2500 });
  if (result.status === "limit") limits++;
  if (
    result.status !== "solved" ||
    result.pushes > 42 ||
    !isInteresting(c.map, result)
  )
    continue;
  const quality = analyze(c.map, result);
  if (
    quality.score < 24 ||
    quality.score > 110 ||
    (count >= 3 && quality.switches < 2)
  )
    continue;
  if (quality.detourPushes === 0 && pool.length - detours >= 200) continue;
  if (quality.detourPushes > 0) detours++;
  verify(c.map, result.solution, result.pushes);
  seen.add(geometry);
  pool.push({ ...c, boxes: count, result, quality });
  if (pool.length % 20 === 0) {
    writeFileSync(
      "tmp/level-candidates.json",
      JSON.stringify(pool, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        selected: pool.length,
        attempts,
        limits,
        detours,
        lastScore: quality.score,
      }),
    );
  }
}
writeFileSync(
  "tmp/level-candidates.json",
  JSON.stringify(pool, null, 2) + "\n",
);
console.log(
  JSON.stringify({ selected: pool.length, attempts, limits, detours }),
);

writeFileSync(
  "data/generation-summary.json",
  JSON.stringify(
    {
      firstSeed: 870001,
      lastSeed: 870000 + attempts,
      attempts,
      acceptedCandidates: pool.length,
      detourCandidates: detours,
      discardedSearchLimits: limits,
    },
    null,
    2,
  ) + "\n",
);
