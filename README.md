# MMM catalog viewer (`mmm-viewer`)

Small **static** web UI for the public **MMM catalog API** ([`mmm-api`](https://github.com/selloa/mmm-api)): browse `GET /v1/entries`, open a row to load `GET /v1/entries/{catalog_id}`. Canonical data remains in [`mmm-data`](https://github.com/selloa/mmm-data); this repo is only a **read-only client** (the “viewer” peer from your architecture notes).

## Run locally

```powershell
cd C:\mmm\mmm-web
npm install
npm run dev
```

Optional: copy `.env.example` to `.env` and set `VITE_MMM_API_BASE` if you are not using the default Railway URL.

## Build for hosting (GitHub Pages, etc.)

```powershell
npm run build
```

Output is in `dist/`. With `base: "./"` in Vite, assets work under a GitHub Pages **project** URL (e.g. `https://YOUR_USER.github.io/mmm-web/`).

## GitHub Pages (CI deploy)

This repo includes [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

1. Push the default branch as **`main`** (or edit the workflow to keep `master` if you use that name).
2. On GitHub: **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions** (not “Deploy from a branch”).
3. Push to `main` (or run **Actions → Deploy GitHub Pages → Run workflow**). When green, the site URL appears under **Pages** and in the workflow summary.

Typical project URL: `https://YOUR_USER.github.io/REPO_NAME/` (example: `https://selloa.github.io/mmm-web/`).

### CORS for Pages

Browsers send **`Origin: https://YOUR_USER.github.io`** (no `/repo` path). On Railway, set **`MMM_CORS_ORIGINS`** on `mmm-api` to that origin (e.g. `https://selloa.github.io`). Add more origins separated by commas if you use several hosts.

### Local dev (no CORS setup)

**`npm run dev`:** requests use **same-origin** `/v1/...` and Vite **proxies** to Railway (see `vite.config.ts`), so you normally **do not** need `MMM_CORS_ORIGINS` for localhost while developing.

## Repo name vs folder

The npm package name is **`mmm-viewer`**. This folder is **`mmm-web`**; create the GitHub repo under the name you prefer and update the footer link in `src/main.ts` if the URL differs from `selloa/mmm-web`.
