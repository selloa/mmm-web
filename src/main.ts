/** Default production API (Railway). */
const DEFAULT_API_BASE = "https://mmm-api-production-7f5a.up.railway.app";

/**
 * Base URL of mmm-api (no trailing slash).
 * In `npm run dev`, defaults to same-origin empty string so Vite can proxy `/v1` (avoids CORS).
 * In production build, defaults to Railway unless `VITE_MMM_API_BASE` is set (e.g. GitHub Pages + env).
 */
function apiBase(): string {
  const raw = import.meta.env.VITE_MMM_API_BASE?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  if (import.meta.env.DEV) return "";
  return DEFAULT_API_BASE;
}

async function fetchJson(path: string): Promise<unknown> {
  const url = `${apiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

type BrowseRow = { catalog_id: string; title: string; category: string };
type BrowsePayload = { entries: BrowseRow[]; count?: number };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Partial<HTMLElementTagNameMap[K]> & { class?: string; text?: string },
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props) {
    const { class: cls, text, ...rest } = props;
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    Object.assign(node, rest);
  }
  for (const c of children) {
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function render(root: HTMLElement): void {
  const base = apiBase();

  const apiLabel =
    base === "" ? `API (dev proxy): ${DEFAULT_API_BASE}` : `API: ${base}`;

  root.appendChild(
    el("header", { class: "site-header" }, [
      el("div", {}, [
        el("h1", { text: "MMM catalog viewer" }),
        el("p", {
          text: "Read-only browse over the public mmm-api. Data lives in mmm-data; this UI is a peer client.",
        }),
      ]),
      el("div", { class: "api-pill", title: base || DEFAULT_API_BASE, text: apiLabel }),
    ]),
  );

  const status = el("div", { class: "status loading", text: "Loading catalog…" });
  root.appendChild(status);

  const layout = el("div", { class: "layout", hidden: true }, [
    el("section", { class: "panel" }, [
      el("div", { class: "panel-header", text: "Browse" }),
      el("div", { class: "table-wrap" }),
    ]),
    el("section", { class: "panel" }, [
      el("div", { class: "panel-header", text: "Entry" }),
      el("div", { class: "detail-body" }, [
        el("p", { class: "muted", text: "Select a row to load the full JSON document." }),
      ]),
    ]),
  ]);
  root.appendChild(layout);

  const foot = el("footer", { class: "footer-note" });
  foot.append("OpenAPI for the API: ");
  const aDocs = el("a", { href: `${base}/docs` });
  aDocs.textContent = `${base}/docs`;
  foot.append(aDocs, " · Source repo: ");
  const aWeb = el("a", { href: "https://github.com/selloa/mmm-web" });
  aWeb.textContent = "mmm-web";
  foot.append(aWeb, " · API repo: ");
  const aApi = el("a", { href: "https://github.com/selloa/mmm-api" });
  aApi.textContent = "mmm-api";
  foot.append(aApi, " · Data: ");
  const aData = el("a", { href: "https://github.com/selloa/mmm-data" });
  aData.textContent = "mmm-data";
  foot.append(aData);
  root.appendChild(foot);

  const tableHost = layout.querySelector(".table-wrap") as HTMLDivElement;
  const detailHost = layout.querySelector(".detail-body") as HTMLDivElement;

  let rows: BrowseRow[] = [];

  function setDetail(html: string): void {
    detailHost.innerHTML = html;
  }

  async function loadDetail(catalogId: string): Promise<void> {
    for (const tr of tableHost.querySelectorAll("tbody tr")) {
      tr.classList.toggle("selected", tr.getAttribute("data-id") === catalogId);
    }
    setDetail(`<p class="status loading">Loading <code>${catalogId}</code>…</p>`);
    try {
      const data = await fetchJson(`/v1/entries/${encodeURIComponent(catalogId)}`);
      const pre = el("pre", {}, [JSON.stringify(data, null, 2)]);
      setDetail("");
      detailHost.appendChild(pre);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setDetail(`<p class="status error">Could not load entry: ${escapeHtml(msg)}</p>`);
    }
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderTable(): void {
    tableHost.innerHTML = "";
    const table = el("table", {}, []);
    const thead = el("thead", {}, [
      el("tr", {}, [
        el("th", { text: "catalog_id" }),
        el("th", { text: "category" }),
        el("th", { text: "title" }),
      ]),
    ]);
    const tbody = el("tbody", {}, []);
    for (const r of rows) {
      const tr = el("tr", {}, [
        el("td", { class: "mono", text: r.catalog_id }),
        el("td", { text: r.category }),
        el("td", { text: r.title }),
      ]);
      tr.dataset.id = r.catalog_id;
      tr.addEventListener("click", () => {
        void loadDetail(r.catalog_id);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(thead);
    table.appendChild(tbody);
    tableHost.appendChild(table);
  }

  void (async () => {
    try {
      const data = (await fetchJson("/v1/entries")) as BrowsePayload;
      rows = Array.isArray(data.entries) ? data.entries : [];
      status.remove();
      layout.hidden = false;
      renderTable();
      if (rows.length === 0) {
        setDetail('<p class="status error">API returned no entries.</p>');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      status.className = "status error";
      status.textContent = `Failed to load /v1/entries: ${msg}`;
    }
  })();
}

render(document.getElementById("app")!);
