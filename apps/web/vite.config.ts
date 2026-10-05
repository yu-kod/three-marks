import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // Phaser（約 1.4MB）はゲーム画面を開いたときだけ読む別チャンク。それ以外はこの上限に収める
    chunkSizeWarningLimit: 1500,
  },
  server: {
    // apps/api のローカルサーバー（npm run dev）へ流す
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
