/**
 * 讀取 data/sub-parts.json，產生四類零件各選一個之笛卡兒積（10^4 組合）。
 * 輸出：data/generated/sub-parts-combinations.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const inputPath = path.join(root, "data", "sub-parts.json");
const outPath = path.join(root, "data", "generated", "sub-parts-combinations.json");

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const { hulls, sterns, bows, bridges } = input;

if (
  !Array.isArray(hulls) ||
  !Array.isArray(sterns) ||
  !Array.isArray(bows) ||
  !Array.isArray(bridges)
) {
  throw new Error("sub-parts.json 需含 hulls、sterns、bows、bridges 陣列");
}

const combinations = [];

for (let hi = 0; hi < hulls.length; hi++) {
  const h = hulls[hi];
  for (let si = 0; si < sterns.length; si++) {
    const s = sterns[si];
    for (let bi = 0; bi < bows.length; bi++) {
      const b = bows[bi];
      for (let ri = 0; ri < bridges.length; ri++) {
        const br = bridges[ri];
        combinations.push({
          hull: hi + 1,
          stern: si + 1,
          bow: bi + 1,
          bridge: ri + 1,
          minRank: Math.max(h.minRank, s.minRank, b.minRank, br.minRank),
          surveillance:
            h.surveillance + s.surveillance + b.surveillance + br.surveillance,
          retrieval: h.retrieval + s.retrieval + b.retrieval + br.retrieval,
          speed: h.speed + s.speed + b.speed + br.speed,
          range: h.range + s.range + b.range + br.range,
          favor: h.favor + s.favor + b.favor + br.favor,
          buildCost:
            h.buildCost + s.buildCost + b.buildCost + br.buildCost,
          magitekRepairMaterials:
            h.magitekRepairMaterials +
            s.magitekRepairMaterials +
            b.magitekRepairMaterials +
            br.magitekRepairMaterials,
        });
      }
    }
  }
}

const out = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: "data/sub-parts.json",
    combinationCount: combinations.length,
    note: "hull／stern／bow／bridge 為各分類陣列之 1-based 零件編號；minRank 為四件最大；其餘數值欄為四件相加。",
  },
  combinations,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out) + "\n", "utf8");

console.log(
  `Wrote ${combinations.length} combinations → ${path.relative(root, outPath)}`,
);
