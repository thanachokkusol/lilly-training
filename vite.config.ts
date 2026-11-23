import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
export default defineConfig({
  base: "./",
  cacheDir: path.join(os.tmpdir(), "lilly-training-vite-cache"),
  server: {
    host: "127.0.0.1", strictPort: true,
    fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/private/**"] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\/](react|react-dom|scheduler)[\/]/.test(id))
            return "react";
          if (/node_modules[\/]recharts[\/]/.test(id)) return "charts";
        },
      },
    },
  },
  plugins: [
    react(),
    {
      name: "precache-app-shell",
      generateBundle(_options, bundle) {
        const names = Object.keys(bundle).filter((n) => !n.endsWith(".map"));
        const hash = createHash("sha256")
          .update(names.join("|"))
          .update(fs.readFileSync("index.html"))
          .digest("hex")
          .slice(0, 12);
        const preload = [
          "./",
          "./icon.svg",
          "./apple-touch-icon.png",
          "./icon-192.png",
          "./icon-512.png",
          "./icon-maskable-512.png",
          "./manifest.webmanifest",
          ...names.filter((n) => n !== "index.html").map((n) => "./" + n),
        ];
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: fs
            .readFileSync("scripts/service-worker.js", "utf8")
            .replace("__BUILD_HASH__", hash)
            .replace("__PRECACHE__", JSON.stringify(preload)),
        });
      },
    },
    {
      name: "production-security-policy",
      transformIndexHtml(html, ctx) {
        if (ctx.server) return html;
        return {
          html,
          tags: [
            {
              tag: "meta",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content:
                  "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/ https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/ 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/ https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/ https://cdn.jsdelivr.net/npm/@tesseract.js-data/; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
              },
              injectTo: "head",
            },
          ],
        };
      },
    },
  ],
});
