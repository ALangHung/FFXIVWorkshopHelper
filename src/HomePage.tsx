import "./HomePage.css";

export function HomePage() {
  return (
    <div className="home-page">
      <header className="home-page-header">
        <p className="home-page-eyebrow">靜態工具網站 · GitHub Pages</p>
        <h1 className="home-page-title">FFXIV 工坊小幫手</h1>
        <p className="home-page-lead">
          專案使用 React、TypeScript、Vite，與 FFXIVGardeningHelper
          相同建置方式；可在此擴充工坊相關工具。
        </p>
        <div className="home-page-actions">
          <code className="home-intro-code">npm run dev</code>
        </div>
      </header>
      <section className="home-section" aria-labelledby="next-steps-heading">
        <h2 className="home-section-title" id="next-steps-heading">
          接下來你可以
        </h2>
        <div className="home-section-body">
          <ul className="home-intro-list">
            <li>
              在 <code className="home-intro-code">src/</code> 新增頁面與元件
            </li>
            <li>
              建置時設定環境變數{" "}
              <code className="home-intro-code">VITE_BASE_PATH</code>（GitHub
              Actions 已帶入倉庫名稱）
            </li>
            <li>
              推送至 <code className="home-intro-code">main</code> 後，於
              Settings → Pages 選擇 GitHub Actions 來源
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
