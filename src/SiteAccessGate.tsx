import { type FormEvent, useState } from "react";
import { tryStoreSiteAccess } from "./siteAccess.ts";
import "./SiteAccessGate.css";

type SiteAccessGateProps = {
  onSuccess: () => void;
};

export function SiteAccessGate({ onSuccess }: SiteAccessGateProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(false);
    setPending(true);
    try {
      const ok = await tryStoreSiteAccess(value);
      if (ok) {
        onSuccess();
        return;
      }
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="app">
      <div
        className="site-access-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-access-title"
      >
        <div className="site-access-dialog">
          <h1 id="site-access-title">存取驗證</h1>
          <p className="site-access-hint">網站開發中，暫不開放使用</p>
          <form className="site-access-form" onSubmit={handleSubmit} noValidate>
            <label className="site-access-label" htmlFor="site-access-code">
              驗證碼
            </label>
            <input
              id="site-access-code"
              className="site-access-input"
              type="password"
              name="site-access-code"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={value}
              onChange={(ev) => {
                setValue(ev.target.value);
                setError(false);
              }}
              disabled={pending}
              aria-invalid={error}
              aria-describedby={error ? "site-access-error" : undefined}
            />
            {error ? (
              <p id="site-access-error" className="site-access-error" role="alert">
                驗證碼錯誤，請重新輸入。
              </p>
            ) : null}
            <button type="submit" className="site-access-submit" disabled={pending}>
              {pending ? "驗證中…" : "送出"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
