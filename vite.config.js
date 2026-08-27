import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// These live in the project root by design (not in `public/`). Vite only
// auto-copies files from `publicDir` (default "public") into the production
// build, so without this plugin they're served fine in local dev (Vite's dev
// server serves the whole project root) but silently missing from `dist` in
// production — the manifest/icons 404 there, which fails PWA installability
// checks and stops the service worker from registering, even though nothing
// looks wrong locally.
const ROOT_ASSETS = [
  "favicon.ico",
  "favicon.svg",
  "favicon-16.png",
  "favicon-32.png",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "manifest.webmanifest",
  "sw.js",
];

function copyRootAssets() {
  let outDir = "dist";
  return {
    name: "copy-root-assets",
    configResolved(config) {
      outDir = path.isAbsolute(config.build.outDir) ? config.build.outDir : path.join(rootDir, config.build.outDir);
    },
    closeBundle() {
      for (const name of ROOT_ASSETS) {
        const src = path.join(rootDir, name);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(outDir, name));
        else console.warn(`[copy-root-assets] expected root asset not found: ${name}`);
      }
    },
  };
}

export default defineConfig({ plugins: [react(), copyRootAssets()] });
