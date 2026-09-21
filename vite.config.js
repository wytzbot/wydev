import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Keep root-level PWA assets available in production, but never fail a build
// because an optional asset is missing. This is important for partial uploads
// and repository updates where a favicon/icon may temporarily be absent.
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
  "offline.html",
];

function copyRootAssets() {
  let outDir;
  return {
    name: "copy-root-assets",
    configResolved(config) {
      outDir = path.resolve(rootDir, config.build.outDir);
    },
    closeBundle() {
      fs.mkdirSync(outDir, { recursive: true });
      for (const name of ROOT_ASSETS) {
        const src = path.join(rootDir, name);
        const dest = path.join(outDir, name);
        if (!fs.existsSync(src)) {
          console.warn(`[copy-root-assets] optional asset missing: ${name}`);
          continue;
        }
        try {
          fs.copyFileSync(src, dest);
        } catch (error) {
          // Do not turn an optional icon/manifest into a failed deployment.
          console.warn(`[copy-root-assets] could not copy ${name}: ${error.message}`);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyRootAssets()],
  build: {
    rollupOptions: {
      output: {
        // Group third-party code by library into its own long-lived chunks,
        // separate from app code. App code changes on every deploy, but
        // these dependencies rarely do — splitting them out means a returning
        // visitor on a slow connection only re-downloads the small app chunk
        // after an update, not React/Firebase/CodeMirror all over again,
        // since the service worker below caches hashed chunks indefinitely.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("firebase")) return "vendor-firebase";
          if (id.includes("codemirror") || id.includes("@uiw")) return "vendor-editor";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("jszip")) return "vendor-jszip";
          if (id.includes("lucide-react")) return "vendor-icons";
          return "vendor";
        },
      },
    },
  },
});
