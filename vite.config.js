import { defineConfig } from "vite";

// 若倉庫為「專案頁」：https://<user>.github.io/<repo>/
// 請將 base 設為 `/<倉庫名稱>/`。若為 user.github.io 根網域倉庫，改為 "/"。
export default defineConfig({
  base: "/FF14WorkshopHelper/",
});
