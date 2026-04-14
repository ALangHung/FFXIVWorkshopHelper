/**
 * 從 ffxiv-teamcraft 複製潛水艇航點對照表至 data/generated：
 * - submarine-voyages.json ← libs/data/src/lib/json/submarine-voyages.json
 * - tw-submarine-voyages.json ← libs/data/src/lib/json/tw/tw-submarine-voyages.json
 *
 * 寫入前處理（依 entry.location）：
 * - submarine-voyages：en/de/fr 去掉尾端「 (location)」；ja 去掉開頭「location」+全形空白（U+3000）。
 * - tw-submarine-voyages：tw 去掉開頭「location」+全形空白。
 *
 *   npm run data:build-submarine-voyages
 *
 * 路徑：環境變數 FF14_TEAMCRAFT_ROOT，未設定則使用專案上一層的 ffxiv-teamcraft。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

const DEFAULT_TEAMCRAFT = resolve(PROJECT_ROOT, "..", "ffxiv-teamcraft");
const TEAMCRAFT_ROOT = process.env.FF14_TEAMCRAFT_ROOT?.trim() || DEFAULT_TEAMCRAFT;

const JSON_LIB = join(TEAMCRAFT_ROOT, "libs", "data", "src", "lib", "json");
const SRC_EN = join(JSON_LIB, "submarine-voyages.json");
const SRC_TW = join(JSON_LIB, "tw", "tw-submarine-voyages.json");

const OUT_DIR = join(PROJECT_ROOT, "data", "generated");
const OUT_EN = join(OUT_DIR, "submarine-voyages.json");
const OUT_TW = join(OUT_DIR, "tw-submarine-voyages.json");

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** 日文／繁中：開頭「X　」（X 為 location，　為 U+3000） */
const IDEOGRAPHIC_SPACE = "\u3000";

function stripParenLocationSuffix(value, location) {
  if (typeof value !== "string" || !location) return value;
  const suffix = ` (${location})`;
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
}

function stripLocationCodePrefix(value, location) {
  if (typeof value !== "string" || !location) return value;
  const prefix = `${location}${IDEOGRAPHIC_SPACE}`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function processSubmarineVoyages(doc) {
  for (const entry of Object.values(doc)) {
    if (!entry || typeof entry !== "object") continue;
    const loc = String(entry.location ?? "").trim();
    for (const key of ["en", "de", "fr"]) {
      if (key in entry) entry[key] = stripParenLocationSuffix(entry[key], loc);
    }
    if ("ja" in entry) {
      entry.ja = stripLocationCodePrefix(entry.ja, loc);
    }
  }
  return doc;
}

function processTwSubmarineVoyages(doc) {
  for (const entry of Object.values(doc)) {
    if (!entry || typeof entry !== "object") continue;
    const loc = String(entry.location ?? "").trim();
    if ("tw" in entry) {
      entry.tw = stripLocationCodePrefix(entry.tw, loc);
    }
  }
  return doc;
}

function main() {
  const en = processSubmarineVoyages(loadJson(SRC_EN));
  const tw = processTwSubmarineVoyages(loadJson(SRC_TW));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_EN, `${JSON.stringify(en, null, 2)}\n`, "utf8");
  writeFileSync(OUT_TW, `${JSON.stringify(tw, null, 2)}\n`, "utf8");

  const enKeys = Object.keys(en).length;
  const twKeys = Object.keys(tw).length;
  console.log(
    `[build-submarine-voyages] ${enKeys} 筆 → ${OUT_EN}（來源 ${SRC_EN}）`,
  );
  console.log(
    `[build-submarine-voyages] ${twKeys} 筆 → ${OUT_TW}（來源 ${SRC_TW}）`,
  );
  if (enKeys !== twKeys) {
    console.warn(
      `[build-submarine-voyages] 警告：英文與繁中筆數不同（${enKeys} vs ${twKeys}）`,
    );
  }
}

main();
