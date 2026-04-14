import { useCallback, useEffect, useMemo, useState } from "react";
import subParts from "../data/sub-parts.json";
import "./HomePage.css";
import "./SubCalculatorPage.css";

type CompareMode = "ignore" | "gte" | "lte";

type ConditionKey =
  | "minRank"
  | "surveillance"
  | "retrieval"
  | "speed"
  | "range"
  | "favor";

const CONDITION_KEYS: ConditionKey[] = [
  "minRank",
  "surveillance",
  "retrieval",
  "speed",
  "range",
  "favor",
];

const CONDITION_LABELS: Record<ConditionKey, string> = {
  minRank: "等級",
  surveillance: "探索",
  retrieval: "收集",
  speed: "航速",
  range: "航距",
  favor: "恩惠",
};

type ComboRow = {
  hull: number;
  stern: number;
  bow: number;
  bridge: number;
  minRank: number;
  surveillance: number;
  retrieval: number;
  speed: number;
  range: number;
  favor: number;
  buildCost: number;
  magitekRepairMaterials: number;
};

type ConditionRow = { mode: CompareMode; valueStr: string };

function defaultConditions(): Record<ConditionKey, ConditionRow> {
  const o = {} as Record<ConditionKey, ConditionRow>;
  for (const k of CONDITION_KEYS) {
    o[k] = { mode: "ignore", valueStr: "" };
  }
  return o;
}

function parseCondValue(mode: CompareMode, valueStr: string): number | null {
  if (mode === "ignore") return null;
  const t = valueStr.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function matchesFilters(
  row: ComboRow,
  unlocked: Set<number>,
  cond: Record<ConditionKey, ConditionRow>,
): boolean {
  if (
    !unlocked.has(row.hull) ||
    !unlocked.has(row.stern) ||
    !unlocked.has(row.bow) ||
    !unlocked.has(row.bridge)
  ) {
    return false;
  }
  for (const key of CONDITION_KEYS) {
    const { mode, valueStr } = cond[key];
    if (mode === "ignore") continue;
    const bound = parseCondValue(mode, valueStr);
    if (bound === null) return false;
    const v = row[key];
    if (mode === "gte" && v < bound) return false;
    if (mode === "lte" && v > bound) return false;
  }
  return true;
}

export function SubCalculatorPage() {
  const partNames = useMemo(
    () => subParts.hulls.map((p) => p.name),
    [],
  );

  const [comboRows, setComboRows] = useState<ComboRow[] | null>(null);
  const [comboMeta, setComboMeta] = useState<{
    combinationCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("../data/generated/sub-parts-combinations.json").then((mod) => {
      if (cancelled) return;
      const d = mod.default as {
        meta: { combinationCount: number };
        combinations: ComboRow[];
      };
      setComboMeta(d.meta);
      setComboRows(d.combinations);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [unlocked, setUnlocked] = useState<Set<number>>(
    () => new Set(partNames.map((_, i) => i + 1)),
  );

  const [conditions, setConditions] = useState<
    Record<ConditionKey, ConditionRow>
  >(() => defaultConditions());

  const [results, setResults] = useState<ComboRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleUnlock = useCallback((index1: number) => {
    setUnlocked((prev) => {
      const next = new Set(prev);
      if (next.has(index1)) next.delete(index1);
      else next.add(index1);
      return next;
    });
  }, []);

  const setConditionMode = useCallback(
    (key: ConditionKey, mode: CompareMode) => {
      setConditions((prev) => ({
        ...prev,
        [key]: {
          mode,
          valueStr: mode === "ignore" ? "" : prev[key].valueStr,
        },
      }));
    },
    [],
  );

  const setConditionValueStr = useCallback(
    (key: ConditionKey, valueStr: string) => {
      setConditions((prev) => ({
        ...prev,
        [key]: { ...prev[key], valueStr },
      }));
    },
    [],
  );

  const runCalculate = useCallback(() => {
    setError(null);
    if (!comboRows) {
      setError("組合資料仍在載入，請稍候再試。");
      setResults(null);
      return;
    }
    if (unlocked.size === 0) {
      setError("請至少選擇一種已解鎖的設計圖。");
      setResults(null);
      return;
    }
    for (const key of CONDITION_KEYS) {
      const { mode, valueStr } = conditions[key];
      if (mode === "ignore") continue;
      if (parseCondValue(mode, valueStr) === null) {
        setError(
          `「${CONDITION_LABELS[key]}」在選擇「大於等於」或「小於等於」時，請輸入有效數字。`,
        );
        setResults(null);
        return;
      }
    }
    const out: ComboRow[] = [];
    for (const row of comboRows) {
      if (matchesFilters(row, unlocked, conditions)) out.push(row);
    }
    setResults(out);
  }, [comboRows, unlocked, conditions]);

  return (
    <div className="home-page sub-calculator-page">
      <header className="home-page-header">
        <p className="home-page-eyebrow">潛水艇</p>
        <h1 className="home-page-title">零件計算器</h1>
        <p className="home-page-lead">
          依已解鎖設計圖與數值條件，從全部組合中篩選符合的配裝。
          {comboMeta ? (
            <span className="sub-calc-meta-line">
              （資料共{" "}
              {comboMeta.combinationCount.toLocaleString("zh-TW")} 組）
            </span>
          ) : (
            <span className="sub-calc-meta-line">（組合資料載入中…）</span>
          )}
        </p>
      </header>

      <section
        className="home-section sub-calc-section"
        aria-labelledby="sub-calc-unlock-heading"
      >
        <h2 className="home-section-title" id="sub-calc-unlock-heading">
          解鎖
        </h2>
        <p className="sub-calc-hint">
          已擁有設計圖的零件才可選用；四個部位僅能各自從已勾選的型號中挑選。
        </p>
        <div className="sub-calc-unlock-grid" role="group" aria-label="已解鎖設計圖">
          {partNames.map((name, i) => {
            const id = i + 1;
            const checked = unlocked.has(id);
            return (
              <label key={name} className="sub-calc-check">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleUnlock(id)}
                />
                <span>{name}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section
        className="home-section sub-calc-section"
        aria-labelledby="sub-calc-calc-heading"
      >
        <h2 className="home-section-title" id="sub-calc-calc-heading">
          計算
        </h2>

        <h3 className="sub-calc-subheading">條件</h3>
        <div className="sub-calc-conditions">
          {CONDITION_KEYS.map((key) => {
            const row = conditions[key];
            const disabled = row.mode === "ignore";
            return (
              <div key={key} className="sub-calc-condition-row">
                <span className="sub-calc-condition-label">
                  {CONDITION_LABELS[key]}
                </span>
                <select
                  className="sub-calc-select"
                  value={row.mode}
                  onChange={(e) =>
                    setConditionMode(key, e.target.value as CompareMode)
                  }
                  aria-label={`${CONDITION_LABELS[key]} 比較方式`}
                >
                  <option value="ignore">忽略</option>
                  <option value="gte">大於等於</option>
                  <option value="lte">小於等於</option>
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  className="sub-calc-num"
                  disabled={disabled}
                  placeholder={disabled ? "—" : "數值"}
                  value={row.valueStr}
                  onChange={(e) =>
                    setConditionValueStr(key, e.target.value)
                  }
                  aria-label={`${CONDITION_LABELS[key]} 條件數值`}
                />
              </div>
            );
          })}
        </div>

        <div className="sub-calc-actions">
          <button
            type="button"
            className="sub-calc-submit"
            onClick={runCalculate}
            disabled={!comboRows}
          >
            計算
          </button>
        </div>
        {error ? (
          <p className="sub-calc-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section
        className="home-section sub-calc-section"
        aria-labelledby="sub-calc-result-heading"
      >
        <h2 className="home-section-title" id="sub-calc-result-heading">
          結果
        </h2>
        {results === null ? (
          <p className="home-placeholder">請設定解鎖與條件後按「計算」。</p>
        ) : results.length === 0 ? (
          <p className="home-placeholder">無符合條件的組合。</p>
        ) : (
          <>
            <p className="sub-calc-result-count">
              共 <strong>{results.length}</strong> 筆符合條件。
            </p>
            <div className="sub-calc-table-wrap">
              <table className="sub-calc-table">
                <thead>
                  <tr>
                    <th scope="col">船身</th>
                    <th scope="col">艉</th>
                    <th scope="col">艏</th>
                    <th scope="col">艦橋</th>
                    <th scope="col">等級</th>
                    <th scope="col">探索</th>
                    <th scope="col">收集</th>
                    <th scope="col">航速</th>
                    <th scope="col">航距</th>
                    <th scope="col">恩惠</th>
                    <th scope="col">建造成本</th>
                    <th scope="col">魔匠修繕材</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={`${r.hull}-${r.stern}-${r.bow}-${r.bridge}-${idx}`}>
                      <td>{partNames[r.hull - 1] ?? "—"}</td>
                      <td>{partNames[r.stern - 1] ?? "—"}</td>
                      <td>{partNames[r.bow - 1] ?? "—"}</td>
                      <td>{partNames[r.bridge - 1] ?? "—"}</td>
                      <td>{r.minRank}</td>
                      <td>{r.surveillance}</td>
                      <td>{r.retrieval}</td>
                      <td>{r.speed}</td>
                      <td>{r.range}</td>
                      <td>{r.favor}</td>
                      <td>{r.buildCost}</td>
                      <td>{r.magitekRepairMaterials}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
