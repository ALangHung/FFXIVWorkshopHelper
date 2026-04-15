import { useMemo, useState, type ReactNode } from "react";
import airItemCatalog from "../data/generated/air-loot-item-catalog.json";
import airAreaData from "../data/generated/air-area.json";
import airLoot from "../data/generated/air-loot.json";
import "./HomePage.css";
import "./AirLootPage.css";

/**
 * AirLootPage — 飛空艇打撈表
 * 畫面配置參照 SubLootPage。
 */

/* ── types ── */

type AirLootItem = {
  rawNameEn: string;
  resolvedNameEn: string | null;
  itemId: number | null;
};

type AirLootTier = {
  tier: number;
  items: AirLootItem[];
};

type AirAreaEntry = {
  name: string;
  start: number;
  end: number;
};

type AirLootRow = {
  id: number;
  star: number | null;
  rank: number | null;
  XP: number | null;
  unlockedBy: number | null;
  unlocks: number[];
  Surveillance: number[];
  Retrieval: number[];
  Favor: number[];
  tiers: AirLootTier[];
};

type AirLootFile = {
  meta: {
    generatedAt?: string;
    itemCatalog?: string;
  };
  rows: AirLootRow[];
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

/* ── data binding ── */

const loot = airLoot as AirLootFile;
const airAreas = airAreaData as AirAreaEntry[];
const catalog = airItemCatalog as CatalogFile;

/* ── helpers (mirror SubLootPage) ── */

function unlockSectorLabel(sectorId: number): string {
  return `${sectorId}`;
}

function thresholdGateEmpty(
  surv: number[],
  retr: number[],
  favor: number[],
): boolean {
  return surv.length === 0 && retr.length === 0 && favor.length === 0;
}

function renderThresholdGate(
  surv: number[],
  retr: number[],
  favor: number[],
): ReactNode {
  if (thresholdGateEmpty(surv, retr, favor)) return "—";
  return (
    <div className="sub-loot-breakpoints">
      {surv.length >= 1 ? <div>探索中: {surv[0]}</div> : null}
      {surv.length >= 2 ? <div>探索高: {surv[1]}</div> : null}
      {retr.length >= 1 ? <div>收集中: {retr[0]}</div> : null}
      {retr.length >= 2 ? <div>收集高: {retr[1]}</div> : null}
      {favor.length >= 1 ? <div>恩惠１: {favor[0]}</div> : null}
      {favor.length >= 2 ? <div>恩惠２: {favor[1]}</div> : null}
    </div>
  );
}

function renderUnlockSectors(
  ids: number[],
): ReactNode {
  if (ids.length === 0) return "—";
  return (
    <div className="sub-loot-breakpoints">
      {ids.map((id, i) => (
        <div key={`${id}-${i}`}>{unlockSectorLabel(id)}</div>
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

function itemLabel(item: AirLootItem, idToName: Map<number, string>): string {
  if (item.itemId != null) {
    const fromCatalog = idToName.get(item.itemId);
    if (fromCatalog) return fromCatalog;
  }
  const resolved = item.resolvedNameEn?.trim();
  if (resolved) return resolved;
  return item.rawNameEn.trim() || "（未知道具）";
}

function formatXp(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("zh-TW");
}

function formatSectorNum(value: number | null): string {
  if (value == null) return "—";
  return String(value);
}

function formatIdRange(area: AirAreaEntry): string {
  if (area.start < 0 || area.end < 0) return "暫無編號範圍";
  if (area.start > area.end) return "暫無編號範圍";
  return `編號 ${area.start}–${area.end}`;
}

function filterRowsForArea(
  rows: AirLootRow[],
  area: AirAreaEntry,
): AirLootRow[] {
  if (area.start < 0 || area.end < 0 || area.start > area.end) return [];
  return rows.filter(
    (r) => typeof r.id === "number" && r.id >= area.start && r.id <= area.end,
  );
}

/* ── component ── */

export function AirLootPage() {
  const [activeAreaIndex, setActiveAreaIndex] = useState(0);

  const idToName = useMemo(() => buildIdToZhName(), []);

  const activeArea = airAreas[activeAreaIndex] ?? airAreas[0];
  const filteredRows = useMemo(() => {
    const area = airAreas[activeAreaIndex] ?? airAreas[0];
    return filterRowsForArea(loot.rows, area);
  }, [activeAreaIndex]);

  return (
    <div className="home-page air-loot-page">
      <header className="home-page-header">
        <p className="home-page-eyebrow">飛空艇</p>
        <h1 className="home-page-title">打撈表</h1>
        <p className="home-page-lead">
          以下為各航點的門檻（探索中／高、收集中／高、恩惠）與探索低／探索中／探索高
          打撈道具；道具名稱優先繁中圖鑑（無則英文）。
        </p>
      </header>

      <section
        className="home-section"
        aria-labelledby="airloot-table-heading"
      >
        <h2 className="home-section-title" id="airloot-table-heading">
          航點與打撈內容
        </h2>
        <div className="home-section-body">
          <nav className="air-loot-sea-tabs" aria-label="依空域切換打撈表">
            <div className="air-loot-sea-tablist" role="tablist">
              {airAreas.map((area, i) => {
                const selected = i === activeAreaIndex;
                return (
                  <button
                    key={area.name}
                    type="button"
                    role="tab"
                    id={`airloot-area-tab-${i}`}
                    className={`air-loot-sea-tab${selected ? " air-loot-sea-tab--active" : ""}`}
                    aria-selected={selected}
                    aria-controls="airloot-area-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveAreaIndex(i)}
                  >
                    <span className="air-loot-sea-tab-name">{area.name}</span>
                    <span className="air-loot-sea-tab-range">
                      {formatIdRange(area)}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <p className="air-loot-active-hint" id="airloot-area-panel-label">
            目前顯示：<strong>{activeArea.name}</strong>
            <span className="air-loot-active-range">
              （{formatIdRange(activeArea)}）
            </span>
          </p>

          <div
            className="air-loot-table-wrap"
            id="airloot-area-panel"
            role="tabpanel"
            aria-labelledby={`airloot-area-tab-${activeAreaIndex}`}
            aria-label={`${activeArea.name}打撈表`}
          >
            <table
              className="air-loot-table"
              aria-describedby="airloot-area-panel-label"
            >
              <thead>
                <tr>
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
                    <td colSpan={9} className="air-loot-empty">
                      此空域目前沒有對應的打撈表列（或尚無編號範圍）。
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

                  return (
                    <tr key={`${row.id}-${idx}`}>
                      <td>
                        <p className="sub-loot-sector">
                          {row.id}
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
                        {row.unlockedBy != null ? unlockSectorLabel(row.unlockedBy) : "—"}
                      </td>
                      <td
                        className={`sub-loot-stat${row.unlocks.length === 0 ? " sub-loot-stat--empty" : " sub-loot-stat--breakpoints"}`}
                      >
                        {renderUnlockSectors(row.unlocks)}
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
