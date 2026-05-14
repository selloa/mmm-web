/** Default production API (Railway). */
const DEFAULT_API_BASE = "https://mmm-api-production-7f5a.up.railway.app";

/** Field order aligned with mmm-catalog-entry v1; unknown keys append sorted. */
const FIELD_ORDER: string[] = [
  "catalog_id",
  "category",
  "title",
  "release_date",
  "authors",
  "forum_thread_url_mmm",
  "wiki_url_mmm",
  "forum_thread_url_adventure_treff",
  "forum_thread_url_adventure_treff_legacy",
  "youtube_longplay_url",
  "download_url_mmm_docman",
  "download_url_mmm_canonical",
  "release_package_filename",
  "release_package_stemname",
  "game_files_subpath",
  "engine",
  "engine_version",
  "mirror_url_github_private",
  "mirror_url_dropbox_public",
];

/** Shown in Details view as plain text — URLs are dead; links would mislead users. */
const LEGACY_NON_LINK_FIELD = "forum_thread_url_adventure_treff_legacy";

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

type DetailMode = "details" | "raw";

const EMPTY_CAT_VALUE = "__none__";

function categoryKey(r: BrowseRow): string {
  return r.category ?? "";
}

function uniqueSortedCategoryKeys(rs: BrowseRow[]): string[] {
  const set = new Set<string>();
  for (const r of rs) set.add(categoryKey(r));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function categoryCounts(rs: BrowseRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rs) {
    const k = categoryKey(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function optionValueForCategoryKey(key: string): string {
  return key === "" ? EMPTY_CAT_VALUE : key;
}

function categoryKeyFromSelectValue(value: string): string | null {
  if (value === "") return null;
  if (value === EMPTY_CAT_VALUE) return "";
  return value;
}

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

function orderedKeys(obj: Record<string, unknown>): string[] {
  const keys = Object.keys(obj);
  const out: string[] = [];
  for (const k of FIELD_ORDER) {
    if (keys.includes(k)) out.push(k);
  }
  const rest = keys.filter((k) => !out.includes(k)).sort();
  return [...out, ...rest];
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function formatValue(val: unknown, fieldKey?: string): Node {
  if (val === null || val === undefined) {
    return el("span", { class: "cell-empty", text: "—" });
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return el("span", { class: "cell-empty", text: "—" });
    return document.createTextNode(val.map(String).join(", "));
  }
  if (typeof val === "object") {
    return document.createTextNode(JSON.stringify(val));
  }
  const s = String(val);
  const linkOk = fieldKey !== LEGACY_NON_LINK_FIELD;
  if (linkOk && isHttpUrl(s)) {
    const a = el("a", {
      href: s,
      rel: "noopener noreferrer",
      target: "_blank",
      class: "field-link",
    });
    a.textContent = s;
    return a;
  }
  return document.createTextNode(s);
}

/** Full-width stacked rows: label on its own line, value below (comfortable for long keys/URLs). */
function buildFieldList(row: Record<string, unknown>): HTMLElement {
  const list = el("div", { class: "field-list" }, []);
  for (const key of orderedKeys(row)) {
    const valueWrap = el("div", { class: "field-value" }, []);
    valueWrap.appendChild(formatValue(row[key], key));
    const block = el("div", { class: "field-row" }, [
      el("div", { class: "field-key", text: key }),
      valueWrap,
    ]);
    list.appendChild(block);
  }
  return list;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

  const detailBody = el("div", { class: "detail-body" });
  const entryActions = el("div", { class: "panel-header-actions", hidden: true });
  const btnDetails = el("button", { type: "button", class: "mode-btn is-active", text: "Details" });
  const btnRaw = el("button", { type: "button", class: "mode-btn", text: "Raw JSON" });
  entryActions.append(btnDetails, btnRaw);

  const browseToolbar = el("div", { class: "browse-toolbar" });
  const browseScroll = el("div", { class: "table-wrap" });

  const layout = el("div", { class: "layout", hidden: true }, [
    el("section", { class: "panel" }, [
      el("div", { class: "panel-header", text: "Browse" }),
      browseToolbar,
      browseScroll,
    ]),
    el("section", { class: "panel" }, [
      el("div", { class: "panel-header panel-header--split" }, [
        el("span", { text: "Entry" }),
        entryActions,
      ]),
      detailBody,
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

  const tableHost = browseScroll;

  let rows: BrowseRow[] = [];
  let selectedCatalogId: string | null = null;
  const browseFilter = { query: "", categorySelect: "" as string };

  const browseSearch = el("input", {
    type: "search",
    class: "browse-search",
    placeholder: "Filter by id, title, or category…",
    spellcheck: false,
  }) as HTMLInputElement;

  const browseCat = el("select", {
    id: "browse-cat-filter",
    class: "browse-cat-select",
  }) as HTMLSelectElement;
  browseCat.setAttribute("aria-label", "Category filter");

  const browseSummary = el("span", { class: "browse-summary" });

  let browseChromeReady = false;

  const detailState: { row: Record<string, unknown> | null; mode: DetailMode } = {
    row: null,
    mode: "details",
  };

  function syncModeButtons(): void {
    btnDetails.classList.toggle("is-active", detailState.mode === "details");
    btnRaw.classList.toggle("is-active", detailState.mode === "raw");
  }

  function renderDetailBody(): void {
    detailBody.replaceChildren();
    if (!detailState.row) {
      entryActions.hidden = true;
      detailBody.appendChild(
        el("p", { class: "muted", text: "Select a row to load an entry." }),
      );
      return;
    }
    entryActions.hidden = false;
    syncModeButtons();
    if (detailState.mode === "raw") {
      detailBody.appendChild(
        el("pre", {}, [JSON.stringify(detailState.row, null, 2)]),
      );
    } else {
      detailBody.appendChild(buildFieldList(detailState.row));
    }
  }

  btnDetails.addEventListener("click", () => {
    if (!detailState.row || detailState.mode === "details") return;
    detailState.mode = "details";
    renderDetailBody();
  });

  btnRaw.addEventListener("click", () => {
    if (!detailState.row || detailState.mode === "raw") return;
    detailState.mode = "raw";
    renderDetailBody();
  });

  function syncBrowseSelection(): void {
    const id = selectedCatalogId;
    for (const rowEl of tableHost.querySelectorAll(".catalog-row")) {
      rowEl.classList.toggle("selected", id !== null && rowEl.getAttribute("data-id") === id);
    }
  }

  function rowMatchesBrowseFilter(r: BrowseRow): boolean {
    const catSel = browseFilter.categorySelect;
    if (catSel !== "") {
      const want = categoryKeyFromSelectValue(catSel);
      if (want !== null && categoryKey(r) !== want) return false;
    }
    const q = browseFilter.query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.catalog_id.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      categoryKey(r).toLowerCase().includes(q)
    );
  }

  function filteredBrowseRows(): BrowseRow[] {
    return rows.filter(rowMatchesBrowseFilter);
  }

  function fillCategorySelect(): void {
    const prev = browseCat.value;
    browseCat.replaceChildren();
    browseCat.appendChild(
      el("option", { value: "", text: `All categories (${rows.length})` }),
    );
    const counts = categoryCounts(rows);
    for (const key of uniqueSortedCategoryKeys(rows)) {
      const n = counts.get(key) ?? 0;
      const label = key === "" ? `(no category) (${n})` : `${key} (${n})`;
      browseCat.appendChild(
        el("option", { value: optionValueForCategoryKey(key), text: label }),
      );
    }
    const keys = new Set(
      uniqueSortedCategoryKeys(rows).map((k) => optionValueForCategoryKey(k)),
    );
    if (prev === "" || keys.has(prev)) browseCat.value = prev;
    else browseCat.value = "";
    browseFilter.categorySelect = browseCat.value;
  }

  function makeCatalogRow(r: BrowseRow): HTMLButtonElement {
    const btn = el("button", {
      type: "button",
      class: "catalog-row",
    }) as HTMLButtonElement;
    btn.dataset.id = r.catalog_id;
    btn.appendChild(
      el("span", { class: "catalog-row-meta" }, [
        el("span", { class: "catalog-id mono", text: r.catalog_id }),
        el("span", { class: "catalog-cat", text: r.category || "—" }),
      ]),
    );
    btn.appendChild(el("span", { class: "catalog-title", text: r.title }));
    btn.addEventListener("click", () => {
      void loadDetail(r.catalog_id);
    });
    return btn;
  }

  function groupRowsByCategory(list: BrowseRow[]): Map<string, BrowseRow[]> {
    const map = new Map<string, BrowseRow[]>();
    for (const r of list) {
      const k = categoryKey(r);
      const arr = map.get(k);
      if (arr) arr.push(r);
      else map.set(k, [r]);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    }
    return map;
  }

  function renderCatalogList(): void {
    const filtered = filteredBrowseRows();
    browseSummary.textContent =
      filtered.length === rows.length
        ? `${rows.length} entries`
        : `${filtered.length} shown · ${rows.length} total`;

    tableHost.replaceChildren();
    if (filtered.length === 0) {
      tableHost.appendChild(
        el("p", {
          class: "browse-empty muted",
          text: 'No entries match the current filters. Try clearing search or choosing "All categories".',
        }),
      );
      syncBrowseSelection();
      return;
    }

    const q = browseFilter.query.trim();
    const catOnly = browseFilter.categorySelect !== "";
    const useGroups = !q && !catOnly;

    if (useGroups) {
      const byCat = groupRowsByCategory(filtered);
      const keys = uniqueSortedCategoryKeys(filtered);
      for (const key of keys) {
        const blockRows = byCat.get(key);
        if (!blockRows?.length) continue;
        const title = key === "" ? "(no category)" : key;
        tableHost.appendChild(el("h3", { class: "catalog-group-head", text: title }));
        const list = el("div", { class: "catalog-rows" }, []);
        for (const r of blockRows) list.appendChild(makeCatalogRow(r));
        tableHost.appendChild(list);
      }
    } else {
      const sorted = [...filtered].sort((a, b) => {
        const c = categoryKey(a).localeCompare(categoryKey(b), undefined, { sensitivity: "base" });
        if (c !== 0) return c;
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      });
      const list = el("div", { class: "catalog-rows" }, []);
      for (const r of sorted) list.appendChild(makeCatalogRow(r));
      tableHost.appendChild(list);
    }
    syncBrowseSelection();
  }

  function setupBrowseChrome(): void {
    if (!browseChromeReady) {
      browseChromeReady = true;
      browseToolbar.append(
        browseSearch,
        el("div", { class: "browse-toolbar-row" }, [
          el("label", { class: "browse-label", htmlFor: "browse-cat-filter", text: "Category" }),
          browseCat,
          browseSummary,
        ]),
      );
      browseSearch.addEventListener("input", () => {
        browseFilter.query = browseSearch.value;
        renderCatalogList();
      });
      browseCat.addEventListener("change", () => {
        browseFilter.categorySelect = browseCat.value;
        renderCatalogList();
      });
    }
    fillCategorySelect();
  }

  async function loadDetail(catalogId: string): Promise<void> {
    selectedCatalogId = catalogId;
    syncBrowseSelection();
    entryActions.hidden = true;
    detailBody.replaceChildren(
      el("p", { class: "status loading", text: `Loading ${catalogId}…` }),
    );
    try {
      const data = await fetchJson(`/v1/entries/${encodeURIComponent(catalogId)}`);
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Unexpected entry payload");
      }
      detailState.row = data as Record<string, unknown>;
      detailState.mode = "details";
      renderDetailBody();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      detailState.row = null;
      entryActions.hidden = true;
      detailBody.innerHTML = `<p class="status error">Could not load entry: ${escapeHtml(msg)}</p>`;
    }
  }

  renderDetailBody();

  void (async () => {
    try {
      const data = (await fetchJson("/v1/entries")) as BrowsePayload;
      rows = Array.isArray(data.entries) ? data.entries : [];
      status.remove();
      layout.hidden = false;
      setupBrowseChrome();
      renderCatalogList();
      if (rows.length === 0) {
        detailBody.innerHTML = '<p class="status error">API returned no entries.</p>';
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      status.className = "status error";
      status.textContent = `Failed to load /v1/entries: ${msg}`;
    }
  })();
}

render(document.getElementById("app")!);
