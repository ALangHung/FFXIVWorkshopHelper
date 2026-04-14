import "./style.css";

document.querySelector("#app").innerHTML = `
  <div class="home-page">
    <header class="home-page-header">
      <p class="home-page-eyebrow">靜態工具網站 · GitHub Pages</p>
      <h1 class="home-page-title">FF14 工坊助手</h1>
      <p class="home-page-lead">
        專案已用 Vite 初始化，可直接開發功能並透過 Actions 部署。
      </p>
      <div class="home-page-actions">
        <code class="home-intro-code">npm run dev</code>
      </div>
    </header>
    <section class="home-section" aria-labelledby="next-steps-heading">
      <h2 class="home-section-title" id="next-steps-heading">接下來你可以</h2>
      <div class="home-section-body">
        <ul class="home-intro-list">
          <li>在 <code class="home-intro-code">src/</code> 新增頁面與模組</li>
          <li>確認 <code class="home-intro-code">vite.config.js</code> 的 <code class="home-intro-code">base</code> 與倉庫名稱一致</li>
          <li>推送至 <code class="home-intro-code">main</code> 後，在倉庫 Settings → Pages 選擇 GitHub Actions 來源</li>
        </ul>
      </div>
    </section>
  </div>
`;
