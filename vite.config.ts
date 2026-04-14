import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function viteBase(): string {
  const raw = process.env.VITE_BASE_PATH?.trim();
  if (!raw) return "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? viteBase() : "/",
}));
