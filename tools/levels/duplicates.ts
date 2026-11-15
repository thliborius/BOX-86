const cache = new Map<string, string>();
/** Trim wall-only margins, then normalize all eight dihedral symmetries. */
export function canonical(map: string, geometryOnly = false) {
  const cacheKey = `${geometryOnly}:${map}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  const rows = map.split("\n");
  let cells = rows.flatMap((row, y) =>
    [...row].flatMap((c, x) =>
      c === "#" ? [] : [[x, y, geometryOnly ? " " : c] as const],
    ),
  );
  const variants: string[] = [];
  for (let mirror = 0; mirror < 2; mirror++)
    for (let rotation = 0; rotation < 4; rotation++) {
      const transformed = cells.map(([x, y, c]) => {
        let a = mirror ? -x : x,
          b = y;
        for (let r = 0; r < rotation; r++) [a, b] = [-b, a];
        return [a, b, c] as const;
      });
      const minX = Math.min(...transformed.map((p) => p[0])),
        minY = Math.min(...transformed.map((p) => p[1]));
      const maxX = Math.max(...transformed.map((p) => p[0])),
        maxY = Math.max(...transformed.map((p) => p[1]));
      const grid = Array.from({ length: maxY - minY + 1 }, () =>
        Array<string>(maxX - minX + 1).fill("#"),
      );
      for (const [x, y, c] of transformed) grid[y - minY][x - minX] = c;
      variants.push(grid.map((r) => r.join("")).join("\n"));
    }
  const result = variants.sort()[0];
  cache.set(cacheKey, result);
  return result;
}
export function geometrySimilarity(a: string, b: string) {
  // Symmetry-normalized floor-mask overlap; only used as an editorial warning.
  const aa = canonical(a, true).split("\n"),
    bb = canonical(b, true).split("\n");
  if (aa.length !== bb.length || aa[0].length !== bb[0].length) return 0;
  let intersection = 0,
    union = 0;
  for (let y = 0; y < aa.length; y++)
    for (let x = 0; x < aa[0].length; x++) {
      if (aa[y][x] === " " || bb[y][x] === " ") union++;
      if (aa[y][x] === " " && bb[y][x] === " ") intersection++;
    }
  return intersection / union;
}

/** Direction and crate-order motif, normalized for rotation, reflection and crate labels. */
export function strategySignature(pattern: string) {
  const tokens = pattern.split("-");
  const variants: string[] = [];
  for (let mirror = 0; mirror < 2; mirror++)
    for (let rotation = 0; rotation < 4; rotation++) {
      const labels = new Map<string, number>();
      variants.push(
        tokens
          .map((token) => {
            const id = token.slice(0, -1),
              direction = token.at(-1)!;
            if (!labels.has(id)) labels.set(id, labels.size);
            let d = "URDL".indexOf(direction);
            if (mirror) d = (4 - d) % 4;
            return `${labels.get(id)}${"URDL"[(d + rotation) % 4]}`;
          })
          .join("-"),
      );
    }
  return variants.sort()[0];
}
export function strategySimilarity(a: string, b: string) {
  const aa = strategySignature(a).split("-"),
    bb = strategySignature(b).split("-");
  const dp = Array<number>(bb.length + 1).fill(0);
  for (const token of aa) {
    let previous = 0;
    for (let j = 1; j <= bb.length; j++) {
      const old = dp[j];
      dp[j] = token === bb[j - 1] ? previous + 1 : Math.max(dp[j], dp[j - 1]);
      previous = old;
    }
  }
  return dp[bb.length] / Math.max(aa.length, bb.length);
}
