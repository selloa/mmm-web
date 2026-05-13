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

Output is in `dist/`. With `base: "./"` in Vite, assets work under a project subpath.

## CORS

**Production** (e.g. GitHub Pages): the API must allow your viewer origin. On Railway, set **`MMM_CORS_ORIGINS`** on `mmm-api` to your deployed site URL (comma-separated for several).

**Local `npm run dev`:** requests use **same-origin** `/v1/...` and Vite **proxies** to Railway (see `vite.config.ts`), so you normally **do not** need CORS entries for localhost while developing.

## Repo name vs folder

The npm package name is **`mmm-viewer`**. This folder is **`mmm-web`**; create the GitHub repo under the name you prefer and update the footer link in `src/main.ts` if the URL differs from `selloa/mmm-web`.
