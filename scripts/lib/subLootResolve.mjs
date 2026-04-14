/**
 * Sub Loot CSV：欄位解析、英文道具名 → teamcraft 查表用鍵
 */

import { parse } from "csv-parse/sync";

/**
 * teamcraft 尚無條目時使用的佔位道具 id（勿與真實道具 id 混淆）。
 * 四語名稱可依需求自訂；目前與 CSV 原文相同。
 */
export const SUB_LOOT_PLACEHOLDER_ID = 900_000_001;

const PLACEHOLDER_BY_RAW = new Map([
  [
    "Mountain Chromite Loft",
    {
      id: SUB_LOOT_PLACEHOLDER_ID,
      nameEn: "Mountain Chromite Loft",
      nameJa: "Mountain Chromite Loft",
      nameZhCN: "Mountain Chromite Loft",
      nameZhTW: "Mountain Chromite Loft",
    },
  ],
]);

/** @param {string} rawLine */
export function resolvePlaceholderItemId(rawLine) {
  const row = PLACEHOLDER_BY_RAW.get(rawLine.trim());
  return row ? String(row.id) : null;
}

/** @param {string} idStr */
export function getPlaceholderCatalogEntry(idStr) {
  for (const row of PLACEHOLDER_BY_RAW.values()) {
    if (String(row.id) === idStr) {
      return {
        id: row.id,
        nameEn: row.nameEn,
        nameJa: row.nameJa,
        nameZhCN: row.nameZhCN,
        nameZhTW: row.nameZhTW,
      };
    }
  }
  return null;
}

/** 試算表常見拼錯／大小寫 → teamcraft items.json 的英文原名 */
export const TYPO_TO_EN = {
  "Climbing Wall Patition": "Climbing Wall Partition",
  "Google-eyed Dogu": "Goggle-eyed Dogu",
  "High-Density Fiberboard": "High-density Fiberboard",
  "Mesquite Bean": "Mesquite Beans",
  "Raw Blac kStar": "Raw Black Star",
  "Raw Ihuykanites": "Raw Ihuykanite",
  "Raw Log Half Patition": "Raw Log Half Partition",
  "Torali Corn Oil": "Turali Corn Oil",
  "Wall-Climbing Ivy": "Wall-climbing Ivy",
};

export const ROMAN_SUFFIXES = [
  "XII",
  "XI",
  "X",
  "IX",
  "VIII",
  "VII",
  "VI",
  "V",
  "IV",
  "III",
  "II",
  "I",
];

/** 試算表簡稱 → 魔晶石系列英文名（不含羅馬數字） */
export const MATERIA_PREFIX_TO_EN = {
  "Direct Hit Rate": "Heavens' Eye Materia",
  "Critical Hit": "Savage Aim Materia",
  Determination: "Savage Might Materia",
  "Skill Speed": "Quickarm Materia",
  "Spell Speed": "Quicktongue Materia",
  Tenacity: "Battledance Materia",
  Piety: "Piety Materia",
  Craftsmanship: "Craftsman's Competence Materia",
  Control: "Craftsman's Cunning Materia",
  CP: "Craftsman's Command Materia",
  GP: "Gatherer's Guile Materia",
  Perception: "Gatherer's Guerdon Materia",
  Gathering: "Gatherer's Grasp Materia",
};

export function shorthandMateriaToFullEn(line) {
  const s = line.trim();
  for (const roman of ROMAN_SUFFIXES) {
    const suf = ` ${roman}`;
    if (!s.endsWith(suf)) continue;
    const base = s.slice(0, -suf.length).trim();
    const series = MATERIA_PREFIX_TO_EN[base];
    if (!series) return null;
    return `${series} ${roman}`;
  }
  return null;
}

/** @param {string} line */
export function resolveLineToEnKey(line) {
  const t = line.trim();
  if (!t) return "";
  let enKey = TYPO_TO_EN[t] ?? t;
  return enKey;
}

/** @param {string} line @param {Map<string, string>} enToId */
export function resolveLineToItemId(line, enToId) {
  const t = line.trim();
  if (!t) return null;
  let enKey = TYPO_TO_EN[t] ?? t;
  if (enToId.has(enKey)) return enToId.get(enKey) ?? null;
  const materiaFull = shorthandMateriaToFullEn(t);
  if (materiaFull && enToId.has(materiaFull))
    return enToId.get(materiaFull) ?? null;
  const ph = resolvePlaceholderItemId(t);
  if (ph) return ph;
  return null;
}

export function buildEnToId(items) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const [id, row] of Object.entries(items)) {
    const en = row?.en?.trim();
    if (!en) continue;
    if (!map.has(en)) map.set(en, id);
  }
  return map;
}

/**
 * @param {string} csvText
 * @returns {{ records: Record<string, string>[], rawHeaderCells: string[], columnKeys: string[] }}
 */
export function parseSubLootCsv(csvText) {
  /** @type {string[]|undefined} */
  let rawHeaderCells;
  const records = parse(csvText, {
    columns: (header) => {
      rawHeaderCells = header;
      return header.map((h, i) => {
        const t = String(h ?? "").trim();
        return t === "" ? `__col${i}` : t;
      });
    },
    skip_empty_lines: false,
    relax_column_count: true,
    relax_quotes: true,
    bom: true,
  });
  const columnKeys =
    records.length > 0
      ? Object.keys(records[0])
      : (rawHeaderCells ?? []).map((h, i) => {
          const t = String(h ?? "").trim();
          return t === "" ? `__col${i}` : t;
        });
  return { records, rawHeaderCells: rawHeaderCells ?? [], columnKeys };
}

/** 略過「NOTE on breakpoint values」說明列 */
export function isNoteBreakpointRow(row) {
  const sector = String(row.Sector ?? "").trim();
  if (!sector.startsWith("NOTE on")) return false;
  const bp = String(row.Breakpoints ?? "").trim();
  return bp.startsWith("T2");
}

export function splitTierLines(cell) {
  if (cell == null || String(cell).trim() === "") return [];
  return String(cell)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @param {string[]} columnKeys */
export function getBreakpointValuesColumnKey(columnKeys) {
  const i = columnKeys.indexOf("Breakpoints");
  if (i >= 0 && columnKeys[i + 1]?.startsWith("__col")) {
    return columnKeys[i + 1];
  }
  return (
    columnKeys.find((k) => k === "__col5") ??
    columnKeys.find((k) => k.startsWith("__col")) ??
    "__col5"
  );
}
