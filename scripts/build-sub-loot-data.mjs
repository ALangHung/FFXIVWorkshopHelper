/**
 * 從英文 Sub Loot CSV 產生：
 * 1) data/generated/sub-loot-item-catalog.json — 道具 id 與 en/ja/zh-Hans/zh-Hant 名稱對照
 * 2) data/generated/sub-loot.json — 結構化列資料（略過 NOTE breakpoint 說明列；Sector 無「Sector n」之分隔列不寫入本檔）
 * 3) data/generated/sea-area.json — 依上述分隔列（原 id 為 null 之列）順序推算各海域 start／end（規則見 buildSeaAreasFromEvents）
 *
 * 繁體：以 opencc-js 將 teamcraft 簡體（zh-items）轉為臺灣繁體（cn → tw）。
 *
 *   npm run data:build-sub-loot
 */

import { Converter } from "opencc-js";
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

function isBlankDataRow(row, bpValuesKey, tierColNames) {
  const s = (v) => String(v ?? "").trim();
  if (s(row.Sector) || s(row["Unlocked By"]) || s(row.Unlocks)) return false;
  if (s(row.Breakpoints) || s(row[bpValuesKey])) return false;
  for (const col of tierColNames) {
    if (splitTierLines(row[col]).length) return false;
  }
  return true;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

const DEFAULT_TEAMCRAFT = resolve(PROJECT_ROOT, "..", "ffxiv-teamcraft");
const TEAMCRAFT_ROOT = process.env.FF14_TEAMCRAFT_ROOT?.trim() || DEFAULT_TEAMCRAFT;

const ITEMS_JSON = join(TEAMCRAFT_ROOT, "libs/data/src/lib/json/items.json");
const ZH_ITEMS_JSON = join(
  TEAMCRAFT_ROOT,
  "libs/data/src/lib/json/zh/zh-items.json",
);

const INPUT_CSV = join(
  PROJECT_ROOT,
  "data/en/FFXIV Airship_Submersible Loot and Builder - Sub Loot.csv",
);
const OUT_DIR = join(PROJECT_ROOT, "data/generated");
const OUT_CATALOG = join(OUT_DIR, "sub-loot-item-catalog.json");
const OUT_SUB_LOOT = join(OUT_DIR, "sub-loot.json");
const OUT_SEA_AREA = join(OUT_DIR, "sea-area.json");

const SEA_NAMES = [
  "溺沒海",
  "灰海",
  "翠浪海",
  "妖哥海",
  "紫礁海",
  "南蒼茫洋",
  "北洋",
];

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** @typedef {{ kind: 'null' } | { kind: 'id'; id: number }} SeaEvent */

/** @param {SeaEvent[]} events */
function prevNumericFromEvents(events, fromIndex) {
  for (let j = fromIndex; j >= 0; j--) {
    const e = events[j];
    if (e.kind === "id") return e.id;
  }
  return null;
}

/** @param {SeaEvent[]} events */
function nextNumericFromEvents(events, fromIndex) {
  for (let j = fromIndex; j < events.length; j++) {
    const e = events[j];
    if (e.kind === "id") return e.id;
  }
  return null;
}

/** @param {SeaEvent[]} events */
function lastNumericFromEvents(events) {
  for (let j = events.length - 1; j >= 0; j--) {
    const e = events[j];
    if (e.kind === "id") return e.id;
  }
  return null;
}

function hasRowIdInInclusiveRange(rows, lo, hi) {
  for (const r of rows) {
    const id = r?.id;
    if (typeof id === "number" && id >= lo && id <= hi) return true;
  }
  return false;
}

/** 無資料或無效範圍時回傳 { start: -1, end: -1 } */
function finalizeSeaBounds(start, end, rows) {
  if (
    typeof start !== "number" ||
    typeof end !== "number" ||
    start > end ||
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return { start: -1, end: -1 };
  }
  if (!hasRowIdInInclusiveRange(rows, start, end)) {
    return { start: -1, end: -1 };
  }
  return { start, end };
}

/**
 * N 個 null 事件對應 N+1 個海域：第 1 個 null 下一個 id → 第一海域 start；之後每個 null 上一 id→前海域 end、下一 id→當前海域 start；
 * 最後一個 null 之後至表尾歸「南蒼茫洋」end=lastId；「北洋」無分隔→-1。
 * @param {SeaEvent[]} events
 * @param {object[]} rowsOut 僅含數字 id 之列（供區間內是否有資料之檢查）
 */
function buildSeaAreasFromEvents(events, rowsOut) {
  const nullIdx = events
    .map((e, i) => (e.kind === "null" ? i : -1))
    .filter((i) => i >= 0);
  const L = nullIdx.length;
  const expectedSeas = SEA_NAMES.length;

  if (L + 1 !== expectedSeas) {
    console.warn(
      `[build-sub-loot] CSV 分隔列（Sector 無編號）共 ${L} 筆，預期 ${expectedSeas - 1} 筆（海域 ${expectedSeas} 個）。sea-area 可能與名稱列未對齊。`,
    );
  }

  const areas = SEA_NAMES.map((name) => ({ name, start: null, end: null }));

  if (L === 0) {
    console.warn(
      "[build-sub-loot] 找不到分隔列，sea-area 全部海域以 -1 輸出。",
    );
  } else {
    const tLimit = Math.min(L, SEA_NAMES.length);
    for (let t = 0; t < tLimit; t++) {
      const i = nullIdx[t];
      const prevId = prevNumericFromEvents(events, i - 1);
      const nextId = nextNumericFromEvents(events, i + 1);
      if (t === 0) {
        areas[0].start = nextId;
      } else {
        areas[t - 1].end = prevId;
        areas[t].start = nextId;
      }
    }
  }

  const lastId = lastNumericFromEvents(events);
  const penultimate = SEA_NAMES.length - 2;
  if (
    L > 0 &&
    SEA_NAMES.length === L + 1 &&
    typeof areas[penultimate]?.start === "number"
  ) {
    areas[penultimate].end = lastId;
  }

  for (const a of areas) {
    const { start, end } = finalizeSeaBounds(a.start, a.end, rowsOut);
    a.start = start;
    a.end = end;
  }

  return areas;
}

/** @param {string} cell CSV 斷點數值欄（以換行分隔，依序對應 T2/T3/Normal/Optimal/Favor） */
function splitBreakpointValueLines(cell) {
  const parts = String(cell ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim());
  while (parts.length < 5) parts.push("");
  return parts;
}

/** 斷點儲存格單行 → number；空或無法解析則 null。 */
function parseBreakpointInt(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** 兩格監視或兩格回收 → 僅收錄可解析的數字，順序保留，長度 0～2。 */
function breakpointPairToNumbers(a, b) {
  const out = [];
  const na = parseBreakpointInt(a);
  const nb = parseBreakpointInt(b);
  if (na != null) out.push(na);
  if (nb != null) out.push(nb);
  return out;
}

const SECTOR_STAR_LINE = /^★+$/;

/** ★ 列字串 → 星星個數（number）；不符合純 ★ 列則 null。 */
function starLineToCount(line) {
  const t = String(line ?? "").trim();
  if (!t || !SECTOR_STAR_LINE.test(t)) return null;
  return (t.match(/★/g) ?? []).length;
}

/** Rank: 後文字 → number；空或無法解析則 null。 */
function parseRankNumber(rankRaw) {
  const t = String(rankRaw ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** @param {string} xpRaw XP: 後原文（可含空白分隔） */
function parseXpNumber(xpRaw) {
  const compact = String(xpRaw ?? "").replace(/\s+/g, "");
  if (!compact) return null;
  const n = Number(compact);
  return Number.isFinite(n) ? n : null;
}

/** CSV 錯字「Sectir」仍視為 Sector。 */
const SECTOR_NUM_PREFIX =
  /^(?:Sector|Sectir)\s+(\d+)\s*$/i;

/** 單行「Sector 1」→ 1；區段標題等非 Sector n 則 null。 */
function sectorHeadToNumber(headLine) {
  const t = String(headLine ?? "").trim();
  if (!t) return null;
  const m = SECTOR_NUM_PREFIX.exec(t);
  return m ? Number(m[1]) : null;
}

/** unlocks：每行符合 Sector n 者收錄為數字，換行為多筆；其餘行略過。 */
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

/** unlockedBy：取第一個 Sector n；無則 null。 */
function sectorRefsCellFirstNumber(cell) {
  const nums = sectorRefsCellToNumbers(cell);
  return nums.length ? nums[0] : null;
}

/** 第一行「Sector 1 | A」→ 左段字串、code「A」；無 | 則左段為整行、code 為空字串。 */
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

/**
 * 將 CSV 的 Sector 儲存格（多行）拆解為 id（number|null）／code（位置代碼字串）／star／rank／XP。
 * XP 為去除空白後的數字，無則 null。航點名稱由前端以 id 對照 voyage JSON。
 */
function parseSectorFields(raw) {
  const full = String(raw ?? "").replace(/\r\n/g, "\n").trimEnd();
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

function main() {
  const items = loadJson(ITEMS_JSON);
  const zhItems = loadJson(ZH_ITEMS_JSON);
  const enToId = buildEnToId(items);
  const cnToTw = Converter({ from: "cn", to: "tw" });

  const csvText = readFileSync(INPUT_CSV, "utf8");
  const { records, columnKeys } = parseSubLootCsv(csvText);
  const bpValuesKey = getBreakpointValuesColumnKey(columnKeys);

  /** @type {Set<string>} */
  const seenIds = new Set();
  /** @type {Set<string>} */
  const unresolvedRaw = new Set();

  /** @param {string} raw */
  function collectFromRaw(raw) {
    const id = resolveLineToItemId(raw, enToId);
    if (id) seenIds.add(id);
    else if (raw.trim()) unresolvedRaw.add(raw.trim());
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
      const zhRow = zhItems[id];
      const nameEn = row?.en?.trim() ?? "";
      const nameJa = row?.ja?.trim() ?? "";
      const nameZhCN = zhRow?.zh?.trim() ?? "";
      let nameZhTW = "";
      if (nameZhCN) {
        try {
          nameZhTW = cnToTw(nameZhCN);
        } catch {
          nameZhTW = nameZhCN;
        }
      }
      return {
        id: Number(id),
        nameEn,
        nameJa,
        nameZhCN,
        nameZhTW,
      };
    })
    .sort((a, b) => a.id - b.id);

  const catalog = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceCsv:
        "data/en/FFXIV Airship_Submersible Loot and Builder - Sub Loot.csv",
      teamcraftItems: "libs/data/src/lib/json/items.json",
      teamcraftZhItems: "libs/data/src/lib/json/zh/zh-items.json",
      noteZhTW:
        "nameZhTW 由 zh-items（簡體）經 OpenCC cn→tw 轉換，與遊戲繁中客戶端用字可能略有差異。",
      placeholders: {
        [String(SUB_LOOT_PLACEHOLDER_ID)]:
          "Mountain Chromite Loft（teamcraft 無條目，佔位 id，四語同原文）",
      },
    },
    items: catalogItems,
  };

  /** @type {SeaEvent[]} */
  const seaEvents = [];
  const rowsOut = [];
  for (const row of records) {
    if (isNoteBreakpointRow(row)) continue;
    if (isBlankDataRow(row, bpValuesKey, tierColNames)) continue;

    const sector = parseSectorFields(row.Sector ?? "");
    if (sector.id == null) {
      seaEvents.push({ kind: "null" });
      continue;
    }

    seaEvents.push({ kind: "id", id: sector.id });

    const tiers = [];
    for (let t = 0; t < tierColNames.length; t++) {
      const col = tierColNames[t];
      const rawLines = splitTierLines(row[col]);
      const itemsOut = rawLines.map((raw) => {
        const itemIdStr = resolveLineToItemId(raw, enToId);
        const itemId = itemIdStr ? Number(itemIdStr) : null;
        const resolvedEn = resolvedEnForLine(raw, enToId);
        return {
          rawNameEn: raw.trim(),
          resolvedNameEn: resolvedEn,
          itemId,
        };
      });
      tiers.push({ tier: t + 1, items: itemsOut });
    }

    const bpVals = splitBreakpointValueLines(row[bpValuesKey] ?? "");
    rowsOut.push({
      ...sector,
      unlockedBy: sectorRefsCellFirstNumber(row["Unlocked By"] ?? ""),
      unlocks: sectorRefsCellToNumbers(row.Unlocks ?? ""),
      Surveillance: breakpointPairToNumbers(bpVals[0], bpVals[1]),
      Retrieval: breakpointPairToNumbers(bpVals[2], bpVals[3]),
      Favor: parseBreakpointInt(bpVals[4]),
      tiers,
    });
  }

  const seaAreas = buildSeaAreasFromEvents(seaEvents, rowsOut);

  const subLootDoc = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceCsv:
        "data/en/FFXIV Airship_Submersible Loot and Builder - Sub Loot.csv",
      skippedRows:
        "NOTE on breakpoint values（含 T2/T3/Normal/Optimal/Favor 與 Minimum Surveillance… 說明）整列不納入",
      voyageFields:
        "id：第一行 | 左段「Sector n」（或 Sectir）之 n，number。code：同列 | 右段位置代碼（A、AA 等），無 | 則空字串。顯示名稱以 id 對照 voyageTwCatalog／voyageEnCatalog。star、rank、unlockedBy、unlocks 同上。CSV 中無 Sector 編號之分隔列不寫入本檔，其順序用於產生 sea-area.json。",
      seaArea: "sea-area.json",
      voyageTwCatalog: "tw-submarine-voyages.json",
      voyageEnCatalog: "submarine-voyages.json",
      breakpointFields:
        "Surveillance／Retrieval：CSV 斷點數值之前兩格／次兩格，各為可解析之整數序列（0～2 個），空則 []。Favor：第五格，number 或 null。",
      unresolvedTierNames: [...unresolvedRaw].sort(),
      itemCatalog: "sub-loot-item-catalog.json",
    },
    rows: rowsOut,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_CATALOG, JSON.stringify(catalog, null, 2), "utf8");
  writeFileSync(OUT_SUB_LOOT, JSON.stringify(subLootDoc, null, 2), "utf8");
  writeFileSync(
    OUT_SEA_AREA,
    `${JSON.stringify(seaAreas, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `[build-sub-loot] catalog: ${catalogItems.length} items → ${OUT_CATALOG}`,
  );
  console.log(`[build-sub-loot] rows: ${rowsOut.length} → ${OUT_SUB_LOOT}`);
  console.log(`[build-sub-loot] sea-area: ${seaAreas.length} → ${OUT_SEA_AREA}`);
  for (const a of seaAreas) {
    console.log(`  ${a.name}: ${a.start} … ${a.end}`);
  }
  if (unresolvedRaw.size > 0) {
    console.warn(
      `[build-sub-loot] ${unresolvedRaw.size} 個 CSV 道具名未能對應 id（見 sub-loot.json meta.unresolvedTierNames）`,
    );
  }
}

main();
