import { useMemo, useState, type ReactNode } from "react";
import itemCatalog from "../data/generated/sub-loot-item-catalog.json";
import seaAreaData from "../data/generated/sea-area.json";
import subLoot from "../data/generated/sub-loot.json";
import submarineVoyages from "../data/generated/submarine-voyages.json";
import twSubmarineVoyages from "../data/generated/tw-submarine-voyages.json";
import "./HomePage.css";
import "./SubLootPage.css";

type SubLootItem = {
  rawNameEn: string;
  resolvedNameEn: string;
  itemId: number;
};

type SubLootTier = {
  tier: number;
  items: SubLootItem[];
};

type TwVoyageEntry = {
  tw: string;
  id: number;
  location: string;
};

type TwVoyagesFile = Record<string, TwVoyageEntry>;

type EnVoyageEntry = {
  en: string;
  id: number;
  location: string;
};

type EnVoyagesFile = Record<string, EnVoyageEntry>;

type SeaAreaEntry = {
  name: string;
  start: number;
  end: number;
};

type SubLootRow = {
  id: number;
  code: string;
  star: number | null;
  rank: number | null;
  XP: number | null;
  unlockedBy: number | null;
  unlocks: number[];
  Surveillance: number[];
  Retrieval: number[];
  Favor: number | null;
  tiers: SubLootTier[];
};

type SubLootFile = {
  meta: {
    generatedAt?: string;
    itemCatalog?: string;
  };
  rows: SubLootRow[];
};

type CatalogFile = {
  meta: {
    placeholders?: Record<string, string>;
  };
  items: Array<{
    id: number;
    nameEn: string;
    nameZhTW: string;
  }>;
};

const loot = subLoot as SubLootFile;
const seaAreas = seaAreaData as SeaAreaEntry[];
const catalog = itemCatalog as CatalogFile;
const voyagesTw = twSubmarineVoyages as TwVoyagesFile;
const voyagesEn = submarineVoyages as EnVoyagesFile;

/** 航點編號 id → 該列代碼（同 sub-loot.json）；重複 id 取先出現者。 */
function buildSectorIdToCode(rows: SubLootRow[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const r of rows) {
    if (!map.has(r.id)) map.set(r.id, r.code);
  }
  return map;
}

const sectorIdToCode = buildSectorIdToCode(loot.rows);

function unlockCodeLabel(sectorId: number, idToCode: Map<number, string>): string {
  const raw = idToCode.get(sectorId);
  const t = raw != null ? raw.trim() : "";
  return t ? t : String(sectorId);
}

function thresholdGateEmpty(
  surv: number[],
  retr: number[],
  favor: number | null,
): boolean {
  return surv.length === 0 && retr.length === 0 && favor == null;
}

function renderThresholdGate(
  surv: number[],
  retr: number[],
  favor: number | null,
): ReactNode {
  if (thresholdGateEmpty(surv, retr, favor)) return "—";
  return (
    <div className="sub-loot-breakpoints">
      {surv.length >= 1 ? <div>探索中: {surv[0]}</div> : null}
      {surv.length >= 2 ? <div>探索高: {surv[1]}</div> : null}
      {retr.length >= 1 ? <div>收集中: {retr[0]}</div> : null}
      {retr.length >= 2 ? <div>收集高: {retr[1]}</div> : null}
      {favor != null ? <div>　恩惠: {favor}</div> : null}
    </div>
  );
}

function renderUnlockCodes(
  ids: number[],
  idToCode: Map<number, string>,
): ReactNode {
  if (ids.length === 0) return "—";
  return (
    <div className="sub-loot-breakpoints">
      {ids.map((id, i) => (
        <div key={`${id}-${i}`}>{unlockCodeLabel(id, idToCode)}</div>
      ))}
    </div>
  );
}

function buildIdToZhName(): Map<number, string> {
  const map = new Map<number, string>();
  for (const it of catalog.items) {
    const tw = it.nameZhTW.trim();
    map.set(it.id, tw || it.nameEn);
  }
  const ph = catalog.meta.placeholders;
  if (ph) {
    for (const [key, label] of Object.entries(ph)) {
      const id = Number(key);
      if (Number.isFinite(id) && label.trim()) map.set(id, label.trim());
    }
  }
  return map;
}

function buildVoyageIdToTw(): Map<number, string> {
  const map = new Map<number, string>();
  for (const entry of Object.values(voyagesTw)) {
    const t = entry.tw.trim();
    if (t) map.set(entry.id, t);
  }
  return map;
}

function buildVoyageIdToEn(): Map<number, string> {
  const map = new Map<number, string>();
  for (const entry of Object.values(voyagesEn)) {
    const t = entry.en.trim();
    if (t) map.set(entry.id, t);
  }
  return map;
}

function itemLabel(item: SubLootItem, idToName: Map<number, string>): string {
  const fromCatalog = idToName.get(item.itemId);
  if (fromCatalog) return fromCatalog;
  return item.resolvedNameEn.trim() || item.rawNameEn.trim() || "（未知道具）";
}

function dashIfEmpty(value: string): string {
  const t = value.trim();
  return t ? t : "—";
}

function formatXp(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("zh-TW");
}

function formatSectorNum(value: number | null): string {
  if (value == null) return "—";
  return String(value);
}

function formatSeaIdRange(area: SeaAreaEntry): string {
  if (area.start < 0 || area.end < 0) return "暫無編號範圍";
  if (area.start > area.end) return "暫無編號範圍";
  return `編號 ${area.start}–${area.end}`;
}

function filterRowsForSea(rows: SubLootRow[], area: SeaAreaEntry): SubLootRow[] {
  if (area.start < 0 || area.end < 0 || area.start > area.end) return [];
  return rows.filter(
    (r) => typeof r.id === "number" && r.id >= area.start && r.id <= area.end,
  );
}

function formatVoyageLabel(
  voyageId: number,
  voyageTw: Map<number, string>,
  voyageEn: Map<number, string>,
): string {
  const tw = voyageTw.get(voyageId)?.trim();
  if (tw) return tw;
  const en = voyageEn.get(voyageId)?.trim();
  if (en) return en;
  return "—";
}

export function SubLootPage() {
  const [activeSeaIndex, setActiveSeaIndex] = useState(0);

  const idToName = useMemo(() => buildIdToZhName(), []);
  const voyageIdToTw = useMemo(() => buildVoyageIdToTw(), []);
  const voyageIdToEn = useMemo(() => buildVoyageIdToEn(), []);

  const activeSea = seaAreas[activeSeaIndex] ?? seaAreas[0];
  const filteredRows = useMemo(() => {
    const area = seaAreas[activeSeaIndex] ?? seaAreas[0];
    return filterRowsForSea(loot.rows, area);
  }, [activeSeaIndex]);

  return (
    <div className="home-page sub-loot-page">
      <header className="home-page-header">
        <p className="home-page-eyebrow">潛水艇</p>
        <h1 className="home-page-title">打撈表</h1>
        <p className="home-page-lead">
          以下為各航點的門檻（探索中／高、收集中／高、恩惠）與探索低／探索中／探索高
          打撈道具；航點名稱優先使用繁中對照（無則改以英文航點表）；道具名稱優先繁中圖鑑（無則英文）。
        </p>
      </header>

      <section
        className="home-section"
        aria-labelledby="subloot-table-heading"
      >
        <h2 className="home-section-title" id="subloot-table-heading">
          航點與打撈內容
        </h2>
        <div className="home-section-body">
          <nav className="sub-loot-sea-tabs" aria-label="依海域切換打撈表">
            <div className="sub-loot-sea-tablist" role="tablist">
              {seaAreas.map((area, i) => {
                const selected = i === activeSeaIndex;
                return (
                  <button
                    key={area.name}
                    type="button"
                    role="tab"
                    id={`subloot-sea-tab-${i}`}
                    className={`sub-loot-sea-tab${selected ? " sub-loot-sea-tab--active" : ""}`}
                    aria-selected={selected}
                    aria-controls="subloot-sea-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveSeaIndex(i)}
                  >
                    <span className="sub-loot-sea-tab-name">{area.name}</span>
                    <span className="sub-loot-sea-tab-range">
                      {formatSeaIdRange(area)}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <p className="sub-loot-active-sea-hint" id="subloot-sea-panel-label">
            目前顯示：<strong>{activeSea.name}</strong>
            <span className="sub-loot-active-sea-range">
              （{formatSeaIdRange(activeSea)}）
            </span>
          </p>

          <div
            className="sub-loot-table-wrap"
            id="subloot-sea-panel"
            role="tabpanel"
            aria-labelledby={`subloot-sea-tab-${activeSeaIndex}`}
            aria-label={`${activeSea.name}打撈表`}
          >
            <table className="sub-loot-table" aria-describedby="subloot-sea-panel-label">
              <thead>
                <tr>
                  <th scope="col">代碼</th>
                  <th scope="col">航點</th>
                  <th scope="col">進入等級</th>
                  <th scope="col">XP</th>
                  <th scope="col">前置</th>
                  <th scope="col">解鎖</th>
                  <th scope="col">門檻</th>
                  <th scope="col">探索低</th>
                  <th scope="col">探索中</th>
                  <th scope="col">探索高</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="sub-loot-empty-sea">
                      此海域目前沒有對應的打撈表列（或尚無編號範圍）。
                    </td>
                  </tr>
                ) : null}
                {filteredRows.map((row, idx) => {
                  const byTier = new Map(
                    row.tiers.map((t) => [t.tier, t.items] as const),
                  );
                  const t1 = byTier.get(1) ?? [];
                  const t2 = byTier.get(2) ?? [];
                  const t3 = byTier.get(3) ?? [];

                  const voyageLabel = formatVoyageLabel(
                    row.id,
                    voyageIdToTw,
                    voyageIdToEn,
                  );

                  return (
                    <tr key={`${row.id}-${row.code}-${idx}`}>
                      <td
                        className={`sub-loot-stat${!row.code.trim() ? " sub-loot-stat--empty" : ""}`}
                      >
                        {dashIfEmpty(row.code)}
                      </td>
                      <td>
                        <p
                          className={`sub-loot-sector${voyageLabel === "—" ? " sub-loot-stat--empty" : ""}`}
                        >
                          {voyageLabel}
                        </p>
                      </td>
                      <td
                        className={`sub-loot-stat${row.rank == null ? " sub-loot-stat--empty" : ""}`}
                      >
                        {formatSectorNum(row.rank)}
                      </td>
                      <td
                        className={`sub-loot-stat${row.XP == null ? " sub-loot-stat--empty" : ""}`}
                      >
                        {formatXp(row.XP)}
                      </td>
                      <td
                        className={`sub-loot-stat${row.unlockedBy == null ? " sub-loot-stat--empty" : ""}`}
                      >
                        {row.unlockedBy == null
                          ? "—"
                          : unlockCodeLabel(row.unlockedBy, sectorIdToCode)}
                      </td>
                      <td
                        className={`sub-loot-stat${row.unlocks.length === 0 ? " sub-loot-stat--empty" : " sub-loot-stat--breakpoints"}`}
                      >
                        {renderUnlockCodes(row.unlocks, sectorIdToCode)}
                      </td>
                      <td
                        className={`sub-loot-stat${thresholdGateEmpty(row.Surveillance, row.Retrieval, row.Favor) ? " sub-loot-stat--empty" : " sub-loot-stat--breakpoints"}`}
                      >
                        {renderThresholdGate(
                          row.Surveillance,
                          row.Retrieval,
                          row.Favor,
                        )}
                      </td>
                      <td>
                        {t1.length === 0 ? (
                          <span className="sub-loot-stat--empty">—</span>
                        ) : (
                          <ul className="sub-loot-item-list">
                            {t1.map((it, i) => (
                              <li key={`${it.itemId}-${i}`}>
                                {itemLabel(it, idToName)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        {t2.length === 0 ? (
                          <span className="sub-loot-stat--empty">—</span>
                        ) : (
                          <ul className="sub-loot-item-list">
                            {t2.map((it, i) => (
                              <li key={`${it.itemId}-${i}`}>
                                {itemLabel(it, idToName)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        {t3.length === 0 ? (
                          <span className="sub-loot-stat--empty">—</span>
                        ) : (
                          <ul className="sub-loot-item-list">
                            {t3.map((it, i) => (
                              <li key={`${it.itemId}-${i}`}>
                                {itemLabel(it, idToName)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loot.meta.generatedAt ? (
            <p className="sub-loot-meta-note">
              資料產生時間：{new Date(loot.meta.generatedAt).toLocaleString(
                "zh-TW",
              )}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
