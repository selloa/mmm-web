import { defineConfig, loadEnv } from "vite";

const DEFAULT_API = "https://mmm-api-production-7f5a.up.railway.app";

// Use `./` so static hosting works under subpaths (e.g. GitHub Pages project sites).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget =
    env.VITE_MMM_API_BASE?.trim().replace(/\/+$/, "") || DEFAULT_API;

  return {
    base: "./",
    server: {
      // Local dev: app uses same-origin `/v1` so the browser avoids CORS; Vite forwards to mmm-api.
      proxy: {
        "/v1": { target: proxyTarget, changeOrigin: true },
        "/docs": { target: proxyTarget, changeOrigin: true },
        "/openapi.json": { target: proxyTarget, changeOrigin: true },
      },
    },
  };
});
