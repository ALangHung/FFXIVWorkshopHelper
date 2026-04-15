/**
 * 從英文 Air Loot CSV 產生：
 * 1) data/generated/air-loot-item-catalog.json — 道具 id 與 en/ja/zh-Hant 名稱對照
 * 2) data/generated/air-loot.json — 結構化列資料
 * 3) data/generated/air-area.json — 空域列表（飛空艇只有一個空域「Sea of Clouds」）
 *
 * 繁體：直接從 teamcraft tw-items.json 取得繁中名稱。
 *
 *   npm run data:build-air-loot
 */


import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEnToId,
  getBreakpointValuesColumnKey,
  getPlaceholderCatalogEntry,
  isNoteBreakpointRow,
  parseSubLootCsv,
  resolveLineToEnKey,
  resolveLineToItemId,
  resolvePlaceholderItemId,
  shorthandMateriaToFullEn,
  splitTierLines,
  SUB_LOOT_PLACEHOLDER_ID,
} from "./lib/subLootResolve.mjs";

/* ── helpers copied / adapted from build-sub-loot-data.mjs ── */

function isBlankDataRow(row, bpValuesKey, tierColNames) {
  const s = (v) => String(v ?? "").trim();
  if (s(row.Sector) || s(row.Unlocks)) return false;
  if (s(row.Breakpoints) || s(row[bpValuesKey])) return false;
  for (const col of tierColNames) {
    if (splitTierLines(row[col]).length) return false;
  }
  return true;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

const DEFAULT_TEAMCRAFT = resolve(PROJECT_ROOT, "..", "ffxiv-teamcraft");
const TEAMCRAFT_ROOT =
  process.env.FF14_TEAMCRAFT_ROOT?.trim() || DEFAULT_TEAMCRAFT;

const ITEMS_JSON = join(TEAMCRAFT_ROOT, "libs/data/src/lib/json/items.json");
const TW_ITEMS_JSON = join(
  TEAMCRAFT_ROOT,
  "libs/data/src/lib/json/tw/tw-items.json",
);

const INPUT_CSV = join(
  PROJECT_ROOT,
  "data/en/FFXIV Airship_Submersible Loot and Builder - Air Loot.csv",
);
const OUT_DIR = join(PROJECT_ROOT, "data/generated");
const OUT_CATALOG = join(OUT_DIR, "air-loot-item-catalog.json");
const OUT_AIR_LOOT = join(OUT_DIR, "air-loot.json");
const OUT_AIR_AREA = join(OUT_DIR, "air-area.json");

/** 飛空艇只有一個空域 */
const AIR_AREA_NAMES = ["雲海"];

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/* ── breakpoint parsing (Air CSV 有 6 行：T2/T3/Mid/High/Lost/DD) ── */

/** @param {string} cell */
function splitBreakpointValueLines(cell) {
  const parts = String(cell ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim());
  while (parts.length < 6) parts.push("");
  return parts;
}

function parseBreakpointInt(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function breakpointPairToNumbers(a, b) {
  const out = [];
  const na = parseBreakpointInt(a);
  const nb = parseBreakpointInt(b);
  if (na != null) out.push(na);
  if (nb != null) out.push(nb);
  return out;
}

/* ── Sector parsing ── */

const SECTOR_STAR_LINE = /^★+$/;

function starLineToCount(line) {
  const t = String(line ?? "").trim();
  if (!t || !SECTOR_STAR_LINE.test(t)) return null;
  return (t.match(/★/g) ?? []).length;
}

function parseRankNumber(rankRaw) {
  const t = String(rankRaw ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseXpNumber(xpRaw) {
  const compact = String(xpRaw ?? "").replace(/\s+/g, "");
  if (!compact) return null;
  const n = Number(compact);
  return Number.isFinite(n) ? n : null;
}

const SECTOR_NUM_PREFIX = /^(?:Sector|Sectir)\s+(\d+)\s*$/i;

function sectorHeadToNumber(headLine) {
  const t = String(headLine ?? "").trim();
  if (!t) return null;
  const m = SECTOR_NUM_PREFIX.exec(t);
  return m ? Number(m[1]) : null;
}

function sectorRefsCellToNumbers(cell) {
  const text = String(cell ?? "").trim();
  if (!text) return [];
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = SECTOR_NUM_PREFIX.exec(t);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

function splitSectorLineAndCode(firstLine) {
  const s = String(firstLine ?? "").trim();
  if (!s) return { head: "", code: "" };
  const pipe = s.indexOf("|");
  if (pipe < 0) return { head: s, code: "" };
  return {
    head: s.slice(0, pipe).trim(),
    code: s.slice(pipe + 1).trim(),
  };
}

function parseSectorFields(raw) {
  const full = String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trimEnd();
  if (!full) {
    return { id: null, code: "", star: null, rank: null, XP: null };
  }
  const lines = full.split("\n").map((l) => l.trim());
  if (lines.length === 1) {
    const { head, code } = splitSectorLineAndCode(lines[0]);
    return {
      id: sectorHeadToNumber(head),
      code,
      star: null,
      rank: null,
      XP: null,
    };
  }

  let starIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SECTOR_STAR_LINE.test(lines[i] ?? "")) {
      starIdx = i;
      break;
    }
  }

  if (starIdx < 0) {
    const [first, ...rest] = lines;
    let rankRaw = "";
    let xpRaw = "";
    for (const line of rest) {
      const rm = /^Rank:\s*(.+)$/i.exec(line);
      if (rm) {
        rankRaw = rm[1].trim();
        continue;
      }
      const xm = /^XP:\s*(.+)$/i.exec(line);
      if (xm) {
        xpRaw = xm[1].trim();
        continue;
      }
    }
    const { head, code } = splitSectorLineAndCode(first);
    return {
      id: sectorHeadToNumber(head),
      code,
      star: null,
      rank: parseRankNumber(rankRaw),
      XP: parseXpNumber(xpRaw),
    };
  }

  const { head, code } = splitSectorLineAndCode(lines[0]);
  const starLine = lines[starIdx] ?? "";
  let rankRaw = "";
  let xpRaw = "";
  for (let i = starIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const rm = /^Rank:\s*(.+)$/i.exec(line);
    if (rm) {
      rankRaw = rm[1].trim();
      continue;
    }
    const xm = /^XP:\s*(.+)$/i.exec(line);
    if (xm) {
      xpRaw = xm[1].trim();
    }
  }
  return {
    id: sectorHeadToNumber(head),
    code,
    star: starLineToCount(starLine),
    rank: parseRankNumber(rankRaw),
    XP: parseXpNumber(xpRaw),
  };
}

function resolvedEnForLine(raw, enToId) {
  const t = raw.trim();
  if (!t) return null;
  if (resolvePlaceholderItemId(raw)) return "Mountain Chromite Loft";
  let en = resolveLineToEnKey(t);
  if (!enToId.has(en)) {
    const m = shorthandMateriaToFullEn(t);
    if (m) en = m;
  }
  return enToId.has(en) ? en : null;
}

/* ── Air CSV 特有的拼字修正 ── */

const AIR_TYPO_TO_EN = {
  "Vivanite": "Vivianite",
  "Cold Ore": "Gold Ore",
  "Althuk Lavender Seeds": "Althyk Lavender Seeds",
  "Deep-gren Crystal": "Deep-green Crystal",
  "Feberite": "Ferberite",
  "Direct Hit Rare IV": "Direct Hit Rate IV",
};

/* ── sea-area (只有一個空域) ── */

function buildAirAreas(rowsOut) {
  if (rowsOut.length === 0) {
    return AIR_AREA_NAMES.map((name) => ({ name, start: -1, end: -1 }));
  }
  const ids = rowsOut
    .map((r) => r.id)
    .filter((id) => typeof id === "number");
  const start = Math.min(...ids);
  const end = Math.max(...ids);
  return AIR_AREA_NAMES.map((name) => ({ name, start, end }));
}

/* ── main ── */

function main() {
  const items = loadJson(ITEMS_JSON);
  const twItems = loadJson(TW_ITEMS_JSON);
  const enToId = buildEnToId(items);

  const csvText = readFileSync(INPUT_CSV, "utf8");
  const { records, columnKeys } = parseSubLootCsv(csvText);
  const bpValuesKey = getBreakpointValuesColumnKey(columnKeys);

  /** @type {Set<string>} */
  const seenIds = new Set();
  /** @type {Set<string>} */
  const unresolvedRaw = new Set();

  /** 先修正 Air CSV 常見拼字錯誤再去查表 */
  function resolveAirItemLine(raw) {
    let t = raw.trim();
    if (!t) return null;
    // Apply air-specific typo fixes
    if (AIR_TYPO_TO_EN[t]) t = AIR_TYPO_TO_EN[t];
    return t;
  }

  /** @param {string} raw */
  function collectFromRaw(raw) {
    let t = raw.trim();
    if (!t) return;
    if (AIR_TYPO_TO_EN[t]) t = AIR_TYPO_TO_EN[t];
    const id = resolveLineToItemId(t, enToId);
    if (id) seenIds.add(id);
    else if (t) unresolvedRaw.add(raw.trim());
  }

  const tierColNames = ["Tier 1", "Tier 2", "Tier 3"];

  for (const row of records) {
    if (isNoteBreakpointRow(row)) continue;
    for (const col of tierColNames) {
      for (const line of splitTierLines(row[col])) {
        collectFromRaw(line);
      }
    }
  }

  const catalogItems = [...seenIds]
    .map((id) => {
      const ph = getPlaceholderCatalogEntry(id);
      if (ph) return ph;
      const row = items[id];
      const twRow = twItems[id];
      const nameEn = row?.en?.trim() ?? "";
      const nameJa = row?.ja?.trim() ?? "";
      const nameZhTW = twRow?.tw?.trim() ?? "";
      return {
        id: Number(id),
        nameEn,
        nameJa,
        nameZhTW,
      };
    })
    .sort((a, b) => a.id - b.id);

  const catalog = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceCsv:
        "data/en/FFXIV Airship_Submersible Loot and Builder - Air Loot.csv",
      teamcraftItems: "libs/data/src/lib/json/items.json",
      teamcraftTwItems: "libs/data/src/lib/json/tw/tw-items.json",
      noteZhTW:
        "nameZhTW 直接取自 teamcraft tw-items.json 繁中翻譯。",
      placeholders: {
        [String(SUB_LOOT_PLACEHOLDER_ID)]:
          "Mountain Chromite Loft（teamcraft 無條目，佔位 id，四語同原文）",
      },
    },
    items: catalogItems,
  };

  const rowsOut = [];
  for (const row of records) {
    if (isNoteBreakpointRow(row)) continue;
    if (isBlankDataRow(row, bpValuesKey, tierColNames)) continue;

    const sector = parseSectorFields(row.Sector ?? "");
    if (sector.id == null) {
      // Air CSV 的空域標題列（如 "Sea of Clouds"）跳過
      continue;
    }

    const tiers = [];
    for (let t = 0; t < tierColNames.length; t++) {
      const col = tierColNames[t];
      const rawLines = splitTierLines(row[col]);
      const itemsOut = rawLines.map((raw) => {
        let fixed = raw.trim();
        if (AIR_TYPO_TO_EN[fixed]) fixed = AIR_TYPO_TO_EN[fixed];
        const itemIdStr = resolveLineToItemId(fixed, enToId);
        const itemId = itemIdStr ? Number(itemIdStr) : null;
        const resolvedEn = resolvedEnForLine(fixed, enToId);
        return {
          rawNameEn: raw.trim(),
          resolvedNameEn: resolvedEn,
          itemId,
        };
      });
      tiers.push({ tier: t + 1, items: itemsOut });
    }

    // Air CSV breakpoint 有 6 行：T2/T3/Mid/High/Lost/DD
    const bpVals = splitBreakpointValueLines(row[bpValuesKey] ?? "");
    const { code: _code, ...sectorWithoutCode } = sector;
    rowsOut.push({
      ...sectorWithoutCode,
      unlocks: sectorRefsCellToNumbers(row.Unlocks ?? ""),
      Surveillance: breakpointPairToNumbers(bpVals[0], bpVals[1]),
      Retrieval: breakpointPairToNumbers(bpVals[2], bpVals[3]),
      Favor: breakpointPairToNumbers(bpVals[4], bpVals[5]),
      tiers,
    });
  }

  // Infer unlockedBy from unlocks
  const unlockedByMap = new Map();
  for (const r of rowsOut) {
    for (const unlockedId of r.unlocks) {
      if (!unlockedByMap.has(unlockedId)) {
        unlockedByMap.set(unlockedId, r.id);
      }
    }
  }

  for (const r of rowsOut) {
    r.unlockedBy = unlockedByMap.get(r.id) ?? null;
  }

  const airAreas = buildAirAreas(rowsOut);

  const airLootDoc = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceCsv:
        "data/en/FFXIV Airship_Submersible Loot and Builder - Air Loot.csv",
      skippedRows:
        "NOTE on breakpoint values（含 T2/T3/Mid/High/Lost/DD 說明）整列不納入",
      voyageFields:
        "id：第一行 | 左段「Sector n」之 n，number。code：同列 | 右段位置代碼（A、B 等），無 | 則空字串。star、rank、unlocks 同上。",
      airArea: "air-area.json",
      breakpointFields:
        "Surveillance：CSV 斷點數值之前兩格（T2/T3），各為可解析之整數序列（0～2 個），空則 []。Retrieval：次兩格（Mid/High）。Favor：第五格（Lost），number 或 null。DD：第六格，number 或 null。",
      unresolvedTierNames: [...unresolvedRaw].sort(),
      itemCatalog: "air-loot-item-catalog.json",
    },
    rows: rowsOut,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_CATALOG, JSON.stringify(catalog, null, 2), "utf8");
  writeFileSync(OUT_AIR_LOOT, JSON.stringify(airLootDoc, null, 2), "utf8");
  writeFileSync(
    OUT_AIR_AREA,
    `${JSON.stringify(airAreas, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `[build-air-loot] catalog: ${catalogItems.length} items → ${OUT_CATALOG}`,
  );
  console.log(`[build-air-loot] rows: ${rowsOut.length} → ${OUT_AIR_LOOT}`);
  console.log(
    `[build-air-loot] air-area: ${airAreas.length} → ${OUT_AIR_AREA}`,
  );
  for (const a of airAreas) {
    console.log(`  ${a.name}: ${a.start} … ${a.end}`);
  }
  if (unresolvedRaw.size > 0) {
    console.warn(
      `[build-air-loot] ${unresolvedRaw.size} 個 CSV 道具名未能對應 id（見 air-loot.json meta.unresolvedTierNames）`,
    );
  }
}

main();
