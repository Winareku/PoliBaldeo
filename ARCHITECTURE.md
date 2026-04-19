# Polibaldeo — Architecture Reference

> **Target audience:** AI agents and developers onboarding to the codebase.  
> **Extension version:** 1.0.0 — Manifest V3, modular shared-script architecture.

---

## 1. Project Overview

Polibaldeo is a Chrome Extension that assists students of **ESPOL** (Escuela Superior Politécnica del Litoral) during course enrollment. It operates exclusively on the university's academic portal and provides two core capabilities:

1. **Capture** — A content script injects a button into the course detail page. When clicked, it scrapes the parallel's schedule data and persists it to `chrome.storage.local`.
2. **Plan** — A standalone planner window reads the stored data, renders a weekly schedule grid, detects time conflicts between parallels, and lets the student select a conflict-free combination.

### Chrome APIs used

| API | Why |
|---|---|
| `chrome.storage.local` | Persists all course/parallel data across popup open/close cycles without a backend. Chosen over `sessionStorage` because it survives the popup lifecycle and is accessible from both the content script and the extension pages. |
| `chrome.runtime.getURL()` | Generates the absolute `chrome-extension://` URL for the planner page before passing it to `chrome.windows.create()`. |
| `chrome.windows.create()` | Opens the planner as a dedicated popup window (not a tab) to keep the scheduling UI separate from the browsing context. |
| `chrome.storage.onChanged` | Allows the popup to reactively re-render when `content.js` writes a new parallel while the popup is simultaneously open. |
| Content Scripts (`content_scripts`) | Declaratively injected at `document_idle` into a single URL pattern. No background/service worker is needed because there is no inter-page messaging — all communication goes through `chrome.storage`. |

---

## 2. File Tree

```
polibaldeo/
│
├── manifest.json               # Extension manifest (MV3)
│
├── content.js                  # Content script: DOM scraper + button injector
├── content.css                 # Styles for injected button and toast
│
├── shared/                     # ── Shared modules (no DOM dependency) ──
│   ├── utils.js                # Pure functions: time math, parsing, palette
│   ├── storage.js              # chrome.storage.local abstraction layer
│   └── exporter.js             # Single source of truth for .poli file generation
│
├── popup/                      # ── Extension popup (toolbar icon click) ──
│   ├── popup.html              # Shell HTML; defines script load order
│   ├── popup-ui.js             # DOM renderers: materia cards, paralelo items
│   └── popup.js                # Orchestrator: button listeners + init
│
├── planner/                    # ── Standalone planner window ──
│   ├── planner.html            # Shell HTML; defines script load order
│   ├── planner-ui.js           # DOM renderers: schedule grid, accordions, footer
│   └── planner.js              # Orchestrator: button listeners + init
│
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 3. Module Map

### `content.js` — DOM Scraper & Entry Point
- **Context:** Runs inside the ESPOL academic page (`MateriaPlanificada.aspx`).
- **`extractData()`** Queries specific `#ctl00_contenido_*` element IDs to read subject name, parallel ID, schedule rows, and professor. Handles both pure-theory and theory+practical parallel combinations by detecting `.mostrar.active` tab elements.
- **`saveData(entry)`** Delegates persistence to `chrome.storage.local.get/set` directly (does not use `shared/storage.js` — content scripts load independently). Merges the new parallel into the existing data tree without overwriting siblings.
- **`injectButton()`** Appends the "Añadir a Polibaldeo" button next to the subject name label. A `MutationObserver` re-runs `injectButton()` to handle SPAs that replace DOM nodes without a full page reload.
- **`showToast(msg, type)`** Renders a temporary notification fixed to the bottom-right of the page.

---

### `shared/utils.js` — Pure Logic
No DOM access. No `chrome.*` calls. Safe to load in any context.

| Symbol | Type | Description |
|---|---|---|
| `PB_GRID_SH / PB_GRID_EH` | `number` | Grid start/end hour (7:00–22:00). |
| `PB_TOTAL_H / PB_HOUR_PX / PB_MIN_PX / PB_GRID_PX` | `number` | Pixel math constants for schedule grid layout. |
| `PB_DAY_MAP` | `object` | Maps Spanish day names → column index (0–4). |
| `PB_PALETTE` | `Array<{bg,fg,ac,dot}>` | 10-color Material 3 Dark palette. Each materia is assigned one index deterministically via `colorCtr`. |
| `pbTimeToMin(s)` | `function` | Converts `"HH:MM[:SS]"` to minutes relative to `PB_GRID_SH`. |
| `pbParseH(horarios)` | `function` | Converts raw schedule strings (e.g. `"Lunes 07:00-09:00"`) into `{di, s, e, raw}` slot objects. Filters out malformed or out-of-range entries. |
| `pbOverlaps(a, b)` | `function` | O(n·m) pairwise check across two slot arrays. Returns `true` on first overlap found. |
| `pbMatKeys(data)` | `function` | Returns materia keys respecting `_order`, falling back to remaining keys. |
| `pbParKeys(mat)` | `function` | Returns parallel keys respecting `_pOrder`, falling back to remaining keys. |

---

### `shared/storage.js` — Data Layer
Thin wrapper over `chrome.storage.local`. All functions are callback-based (no Promises) to maintain MV3 compatibility without requiring `async/await` polyfills.

| Function | Description |
|---|---|
| `pbLoadData(cb)` | Reads `polibaldeo_data`. Always calls `cb` with a valid object (never `null`). Falls back to `{ _order: [] }` if key is missing. |
| `pbSaveData(data, cb?)` | Writes the full data object. Wraps the key automatically. |
| `pbClearData(cb?)` | Removes `polibaldeo_data` entirely. |
| `pbAddEntry(entry, cb?)` | High-level write: creates the materia node if absent, pushes the parallel, and calls `pbSaveData`. Used by `content.js` indirectly (content.js has its own inline version due to isolated context). |

**Data schema stored in `chrome.storage.local`:**

```jsonc
{
  "_order": ["MATERIA_A", "MATERIA_B"],  // Display order
  "MATERIA_A": {
    "creditos": "4",
    "collapsed": false,
    "_pOrder": ["101", "101-1"],          // Parallel display order
    "paralelos": {
      "101": {
        "horarios": ["Lunes 07:00-09:00", "Miércoles 07:00-09:00"],
        "info": "Paralelo Teórico\nProfesor: Juan Pérez"
      },
      "101-1": {                           // Theory-practical combo ID: "teorico-practico"
        "horarios": ["Lunes 07:00-09:00", "Viernes 11:00-13:00"],
        "info": "Paralelo Teórico\nProfesor: Juan Pérez\n\nParalelo Práctico 1\nUbicación: ..."
      }
    }
  }
}
```

---

### `shared/exporter.js` — File Generator
Single source of truth for `.poli` file format. Previously duplicated in both `popup.js` and `planner.js`; now consumed by both.

| Function | Signature | Description |
|---|---|---|
| `pbGeneratePoliContent` | `(data, selected?) → string` | Builds the UTF-8 + BOM text. If `selected` is provided (Planner mode), only the chosen parallel per materia is included. If `null` (Popup mode), all parallels are exported. |
| `pbExportPoliFile` | `(data, selected?) → boolean` | Calls `pbGeneratePoliContent`, creates a `Blob`, triggers a download via a temporary `<a>` element. Returns `false` if content is empty. |

**`.poli` file format:**
```
MATERIA_NAME|creditos
paraleloId | Lunes 07:00-09:00; Miércoles 07:00-09:00 | 0 | Paralelo Teórico\nProfesor: ...

MATERIA_NAME_2|creditos
...
```

---

### `popup/popup-ui.js` — Popup Renderer
Owns all DOM construction for the popup. Stateful via `PopupState`.

| Symbol | Description |
|---|---|
| `PopupState` | `{ currentData, isInternalChange }`. `isInternalChange` is a write-lock flag that prevents `chrome.storage.onChanged` from triggering a redundant re-render after a user-initiated save. |
| `popupRender(data)` | Full re-render: clears `#materias-list`, rebuilds all materia cards in `_order` sequence. |
| `popupBuildMateriaCard(nombre, mat)` | Creates the card element with credit stepper, collapse toggle, and up/down reorder controls. |
| `popupBuildParaleloItem(...)` | Creates the parallel row with professor name, schedule tags, and delete button. |
| `popupSaveVisualState()` | Reads the current DOM order back into a new data object and persists it. This is the mechanism for reordering (drag-free, arrow-button based). |
| `popupSetStatus(msg, type)` | Writes a 3-second message to `#status-bar`. |
| `popupUpdateCounter()` | Updates the `#total-counter` chip in the header. |

---

### `popup/popup.js` — Popup Orchestrator
Pure wiring. No rendering logic.

- Opens the planner via `chrome.windows.create({ url: chrome.runtime.getURL('planner/planner.html') })`.
- Binds export, clear, and storage change listener.
- Calls `pbLoadData → popupRender` on init.

---

### `planner/planner-ui.js` — Planner Renderer
Owns all DOM construction for the schedule grid and left panel. Stateful via `PlannerState`.

| Symbol | Description |
|---|---|
| `PlannerState` | `{ data, selected, colorMap, colorCtr }`. `selected` maps `materia → paraleloId` for currently active parallels. `colorMap` maps each materia to a stable `PB_PALETTE` index. |
| `plannerBuildGrid()` | Constructs the static grid skeleton: time gutter labels + 5 day columns with hour/half-hour divider lines. Called once on load. |
| `plannerDrawBlocks()` | Iterates `selected`, calls `pbParseH` per parallel, and absolutely positions `.ev-block` divs within the appropriate `#dc-{di}` day column. |
| `plannerRenderLeft()` | Full rebuild of all `.accordion` elements. Calls `plannerBuildCMap()` to classify each parallel as selected / conflicting / disabled / normal before rendering. |
| `plannerBuildCMap()` | Builds the conflict map. For each non-selected parallel, runs `pbOverlaps` against every other materia's selected slots. O(M·P·S²) where M=materias, P=paralelos, S=slots. |
| `plannerUpdateFooter()` | Sums credits of selected parallels; shows/hides `#conflict-badge`. |
| `plannerRefresh()` | Calls `renderLeft → drawBlocks → updateFooter` in sequence. Entry point after any state mutation. |

---

### `planner/planner.js` — Planner Orchestrator
Pure wiring. No rendering logic.

- Binds deselect-all, collapse-all, and export buttons.
- Export logic: calls `pbExportPoliFile(data, selected)`. If `selected` is empty, falls back to exporting all data.
- Calls `pbLoadData → plannerBuildGrid → plannerRefresh` on init.

---

## 4. Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESPOL Academic Page                          │
│                                                                 │
│  DOM (#ctl00_contenido_*)                                       │
│       │                                                         │
│       ▼                                                         │
│  content.js::extractData()                                      │
│       │  { materia, paraleloId, horarios, info, creditos }      │
│       ▼                                                         │
│  content.js::saveData()                                         │
│       │                                                         │
│       ▼                                                         │
│  chrome.storage.local.set("polibaldeo_data", {...})  ◄──────┐  │
└──────────────────────────────────────────────────────────────┼──┘
                                                               │
           chrome.storage.onChanged fires                      │
                      │                                        │
          ┌───────────▼────────────┐                          │
          │       popup.js         │                          │
          │  onChanged → render()  │                          │
          └───────────┬────────────┘                          │
                      │                                        │
          ┌───────────▼────────────┐       write back         │
          │     popup-ui.js        │ ─── saveVisualState() ───┘
          │  buildMateriaCard()    │     (reorder / credit
          │  buildParaleloItem()   │      edit / delete)
          └───────────┬────────────┘
                      │
          btn-planner clicked
          chrome.windows.create()
                      │
          ┌───────────▼────────────┐
          │      planner.js        │
          │  pbLoadData() → init   │
          └───────────┬────────────┘
                      │
          ┌───────────▼────────────┐
          │    planner-ui.js       │
          │  buildGrid()           │
          │  renderLeft()          │  ◄── user clicks parallel
          │    buildCMap()         │       PlannerState.selected
          │  drawBlocks()          │       mutates → refresh()
          │  updateFooter()        │
          └────────────────────────┘
```

> **Key design decision — no `sendMessage`:** All inter-context communication goes through `chrome.storage`. This avoids the need for a background service worker, simplifies the architecture, and means the planner window always reads a consistent snapshot. The tradeoff is that the planner does **not** live-update while open (by design — static enrollment snapshot).

---

## 5. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Extension platform | Chrome MV3 | No background service worker. No ES Modules (`import/export`) — scripts are loaded as globals in explicit order via `<script>` tags in HTML. |
| Language | Vanilla ES5-compatible JavaScript | `var`, callbacks, no transpiler. Chosen for maximum compatibility and zero build tooling. |
| Styling | Plain CSS with CSS Custom Properties | Material 3 Dark token palette defined in `:root`. No CSS preprocessor. |
| Typography | [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) | Loaded from Google Fonts CDN at runtime. |
| Icons | [Material Symbols Outlined](https://fonts.google.com/icons) | Variable font loaded from Google Fonts. Rendered via `.sym` class + ligature text content (e.g. `calendar_month`). |
| Storage | `chrome.storage.local` | ~5MB quota. Synchronous-feel via callbacks. No IndexedDB, no external DB. |
| Build toolchain | None | Source files are loaded directly by Chrome. No Webpack, Vite, Rollup, or TypeScript compilation step. |
| Dependencies | None (zero `node_modules`) | No React, no jQuery, no utility libraries. |

---

## 6. Script Load Order (Critical)

Because there are no ES Modules, globals must be available before consumers load. Both HTML files enforce this exact order:

```
1. shared/utils.js      → defines PB_* constants + pb* pure functions
2. shared/storage.js    → defines pbLoadData, pbSaveData, pbClearData, pbAddEntry
3. shared/exporter.js   → defines pbGeneratePoliContent, pbExportPoliFile
4. {context}-ui.js      → defines PlannerState/PopupState + all render functions
5. {context}.js         → runs the orchestrator IIFE, wires listeners, calls init
```

Swapping any two steps will produce `ReferenceError` at runtime.

---

## 7. Extension Permissions

```jsonc
"permissions": [
  "storage",     // chrome.storage.local read/write
  "activeTab",   // Reserved; not currently used by content script (injected declaratively)
  "windows"      // chrome.windows.create() for the planner popup
]
```

The content script is declaratively injected via `content_scripts` in the manifest. No `scripting` permission is needed because `chrome.scripting.executeScript()` is never called programmatically.
