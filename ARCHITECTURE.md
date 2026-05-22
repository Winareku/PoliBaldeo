# Polibaldeo — Architecture Reference

> **Target audience:** AI agents and developers onboarding to the codebase.
> **Extension version:** 1.4.1 — Manifest V3, modular shared-script architecture.

---

## 1. Project Overview

Polibaldeo es una extensión de Chrome diseñada para asistir a los estudiantes de la **ESPOL** (Escuela Superior Politécnica del Litoral) durante el proceso de matriculación. Opera exclusivamente en el portal académico de la universidad y ofrece dos capacidades principales:

1.  **Capture (Captura):** Un script de contenido inyecta un **botón split** (con menú desplegable) y un navegador de paralelos en la página de detalles de la materia. El botón principal permite añadir o actualizar el paralelo actual (teórico + práctico activo). El menú desplegable incluye la opción **"Añadir todo"**, que recorre **todas las combinaciones de paralelos prácticos asociados** al teórico (sin recargar la página), extrae sus horarios, profesor, ubicación, exámenes y los persiste en `chrome.storage.local` en un solo lote.
2.  **Plan & Organize (Planificación):** Un panel lateral persistente (Side Panel) y una ventana de planificador independiente leen los datos almacenados, renderizan una cuadrícula de horarios semanal, detectan conflictos de tiempo (incluyendo solapamiento de exámenes), permiten alternar entre la vista de clases y la vista de exámenes, exportar la selección a imagen PNG o a calendario, y gestionar los datos mediante importación/exportación en formato JSON. La selección del usuario, la configuración de colores y el estado de los acordeones se conservan automáticamente y se sincronizan entre las distintas vistas.

### Chrome APIs used

| API | Why |
|---|---|
| `chrome.storage.local` | Persiste los datos de materias, paralelos, selección del usuario, mapa de colores y otros metadatos. |
| `chrome.sidePanel` | Mantiene la interfaz de usuario de la extensión abierta de forma persistente en la barra lateral. |
| `chrome.action` | Escucha los clics en el icono de la barra de herramientas para abrir el Side Panel. |
| `chrome.windows.create()` | Abre el planificador principal como una ventana emergente dedicada (no una pestaña). |
| `chrome.storage.onChanged` | Permite que el Side Panel y el Planificador se actualicen en tiempo real cuando cualquiera de ellos modifica los datos. |

---

## 2. File Tree

```text
polibaldeo/
├── ARCHITECTURE.md             # Este documento
├── README.md                   # Documentación del proyecto
├── assets/                     # Imágenes de marketing / tienda (no forman parte del bundle)
│   ├── PoliBaldeo_LogoBanner.png
│   └── ...
├── manifests/
│   └── manifest.base.json      # Manifiesto base. Copiar a src/manifest.json antes de cargar la extensión.
└── src/                        # ── Código Fuente (raíz del paquete de la extensión) ──
    ├── manifest.json           # Copia de manifests/manifest.base.json (requerida por Chrome)
    │
    ├── assets/
    │   └── icons/              # Iconos del paquete de la extensión
    │       ├── icon16.png
    │       ├── icon48.png
    │       ├── icon128.png
    │       └── polibaldeo_logo_toolbar.png
    │
    ├── background/             # Service Workers por plataforma
    │   ├── chromium.js         # Chrome/Edge: abre el Side Panel via chrome.sidePanel
    │   ├── opera.js            # Opera: abre ui.html como ventana popup
    │   └── firefox.js          # Firefox: alterna sidebar_action via browser.*
    │
    ├── manifests/              # Manifiestos por plataforma
    │   ├── manifest.chromium.json  # MV3 — sidePanel
    │   ├── manifest.opera.json     # MV3 — sin sidePanel, usa windows.create
    │   └── manifest.firefox.json   # MV2 — sidebar_action, browser.* API
    │
    ├── content/                # ── Script de contenido ──
    │   ├── content-scraper.js  # Lógica de extracción de datos
    │   ├── content-navigator.js# Navegador de paralelos y botón de captura
    │   └── content.css         # Estilos para el botón y navegador de paralelos
    │
    ├── platform/               # Reservado para variantes multi-browser (futuro)
    │   ├── chromium/
    │   ├── firefox/
    │   └── opera/
    │
    ├── shared/                 # ── Módulos compartidos ──
    │   ├── utils.js            # Funciones puras: matemáticas de tiempo, paleta de colores
    │   ├── storage.js          # Capa de abstracción de chrome.storage.local
    │   ├── exporter.js         # Generación de archivos .poli (JSON)
    │   ├── ics-exporter.js     # Generación de archivos iCalendar (.ics)
    │   │
    │   ├── components/         # Componentes UI reutilizables
    │   │   └── modal.js        # Componente PBModal para crear modales dinámicos
    │   │
    │   ├── fonts/              # Fuentes locales
    │   │   ├── plus-jakarta-sans-400.woff2
    │   │   ├── plus-jakarta-sans-600.woff2
    │   │   ├── plus-jakarta-sans-700.woff2
    │   │   └── material-symbols-outlined.woff2
    │   │
    │   ├── icons/              # Iconos SVG de UI compartidos
    │   │   ├── polibaldeo_logo.svg
    │   │   └── kofi_button.svg
    │   │
    │   ├── libs/               # Librerías de terceros
    │   │   └── html-to-image.min.js  # Captura de HTML a imagen PNG
    │   │
    │   └── styles/             # Hojas de estilo modulares compartidas
    │       ├── fonts.css       # Definiciones @font-face para fuentes locales
    │       ├── variables.css   # Variables globales de color y tipografía
    │       ├── base.css        # Reset y estilos base
    │       ├── buttons.css     # Componentes de botones reutilizables
    │       ├── modal.css       # Estilos para el modal genérico
    │       └── components.css  # Componentes visuales compartidos (stepper, píldoras, tags)
    │
    └── ui/                     # ── Interfaz Principal (Side Panel + Planner) ──
        ├── ui.html             # Estructura HTML del Side Panel
        ├── ui.js               # Orquestador: listeners de botones e importación
        ├── ui.css              # Componentes visuales del panel lateral
        ├── layout.css          # Estructura de grid y dimensiones del panel
        ├── state.js            # Gestión del estado global (UIState, EditModalState)
        ├── toasts.js           # Sistema de notificaciones tipo toast
        ├── modals.js           # Diálogos modales (edición de paralelos, materias)
        ├── cards.js            # Renderizado de tarjetas de materias y paralelos
        ├── drag.js             # Funcionalidad de drag & drop
        └── planner/            # ── Ventana del Planificador ──
            ├── planner.html    # Estructura HTML de la cuadrícula
            ├── planner.js      # Orquestador: lógica de selección, botones y toasts
            ├── planner.css     # Componentes visuales del planner
            ├── planner-layout.css  # Estructura de paneles y grid
            ├── planner-conflicts.js# Lógica de detección de conflictos (horarios y exámenes)
            ├── planner-grid.js # Renderizado de la grilla de horarios
            ├── planner-ui.js   # Gestión de estado y panel izquierdo (acordeones)
            └── test.js         # Validación de lógica de conflictos (off-browser)
```

---

## 3. Module Map

### `src/background/` — Service Workers por plataforma

Cada archivo es autónomo y sólo contiene la lógica de integración específica de la plataforma. La aplicación (`ui/`, `shared/`, `content/`) es idéntica en todos.

| Archivo | Plataforma | Estrategia |
|---|---|---|
| `chromium.js` | Chrome / Edge | `chrome.sidePanel.open({ tabId })` |
| `opera.js` | Opera | `chrome.windows.create({ type: 'popup', url: 'ui/ui.html' })` |
| `firefox.js` | Firefox | `browser.sidebarAction.open()` / `.close()` toggle |

### `src/content/content-scraper.js` — Captura de Datos
Se inyecta en el portal académico. Contiene las funciones `parseExamInfo`, `_extractData`, `saveData`, `showToast` y `captureData`. Extrae horarios, profesor, ubicación y exámenes, y persiste los datos en `chrome.storage.local`.

### `src/content/content-navigator.js` — Interfaz de Navegación
Inyecta un **botón split** (con menú desplegable) y un navegador de paralelos estilo Material 3. El botón principal captura el paralelo teórico actual junto con el práctico activo (o el único práctico). El menú desplegable ofrece la opción **"Añadir todo"**, que extrae eficientemente todas las combinaciones de prácticos asociados al teórico **sin recargar la página**, leyendo directamente los contenedores DOM ocultos (`tabla_*`) y guardando los datos en lote para evitar conflictos de concurrencia. Utiliza un `MutationObserver` para garantizar su persistencia.

### `src/shared/ics-exporter.js` — Exportación a Calendario
Módulo encargado de transformar la selección del usuario en un archivo `.ics` compatible con Google Calendar u Outlook.
- **Lógica de Recurrencia:** Utiliza `RRULE` para definir clases semanales durante un periodo determinado (por defecto 18 semanas).
- **Manejo de Fechas:** Calcula la primera ocurrencia de cada clase basándose en el índice del día (0-4 para Lunes-Viernes) y una fecha de inicio de semestre.

### `src/shared/components/modal.js` — Componente PBModal
Proporciona una API simple para crear modales dinámicos (`PBModal.create({ title, body, footer })`). Retorna un objeto con métodos `open()`, `close()`, `destroy()` y `getElement(selector)`. Elimina la necesidad de overlays hardcodeados en los HTML.

### `src/ui/state.js` — Gestión de Estado
Define las variables globales de estado del panel lateral:
- `UIState`: Objeto con `currentData` (materias y paralelos) e `isInternalChange` (flag de sincronización).
- `EditModalState`: Contexto para el modal de edición de paralelos.
- `uiColorMap` y `uiColorCtr`: Mapeo de colores de la paleta para cada materia.
- `uiSaveVisualState()`: Persiste el estado visual (orden, créditos, estado colapsado) en el almacenamiento, preservando los metadatos existentes como `_selected` y `_colorMap`.

### `src/ui/toasts.js` — Sistema de Notificaciones
Implementa un sistema de toasts para notificaciones al usuario:
- `uiSetStatus(msg, type)`: Muestra notificaciones simples (success, warning, info).
- `pbShowUndoToast(msg, undoFn)`: Muestra notificaciones con acción de "Deshacer".
- `_removeToastEntry()`: Gestiona la limpieza de toasts.

### `src/ui/modals.js` — Diálogos Modales
Contiene todos los modales de la interfaz:
- `pbConfirm(msg, onOk, onCancel)`: Modal genérico de confirmación.
- `uiOpenEditModal(materia, pId, isNew)`: Modal para editar/crear paralelos (horarios, profesor, ubicación, exámenes).
- `uiOpenMateriaModal()`: Modal para crear nuevas materias.
- `uiStartNameEdit(nameEl, card)`: Edición inline del nombre de materia; transfiere el color al renombrar y regenera la vista completa.
- Helpers: `pbParseHorarioStr()`, `pbParseInfo()`, `pbBuildInfo()`, `_pbNextParId()`.

### `src/ui/cards.js` — Renderizado de UI
Funciones de construcción y renderizado de elementos DOM:
- `uiRender(data)`: Punto de entrada principal, renderiza la lista de materias; restaura los colores desde `_colorMap` si existe.
- `uiBuildMateriaCard(nombre, mat)`: Crea la tarjeta de una materia con controles.
- `uiBuildParaleloItem(nombreMateria, nParalelo, data, parentList)`: Crea un item de paralelo.
- `uiToggleCollapseAll()`: Alterna el estado colapsado de todas las materias.
- `uiUpdateCounter()`: Actualiza el contador de materias en el header.

### `src/ui/drag.js` — Drag & Drop
Implementa la funcionalidad de arrastrar y soltar:
- `pbInitDragHandle(handleEl, itemEl, containerEl, onDrop)`: Inicializa drag & drop para reordenar elementos.

### `src/ui/ui.js` — Orquestador del Side Panel
Gestiona las acciones principales del panel lateral:
- **Importación:** Procesa archivos `.poli` en formato JSON (con fallback al formato de texto antiguo).
- **Navegación:** Abre el planificador en una ventana popup optimizada (`ui/planner/planner.html`, 1000×700px).
- **Sincronización:** Escucha cambios en `chrome.storage.local` para refrescar la lista de materias.

### `src/ui/planner/planner-conflicts.js` — Lógica de Conflictos
Módulo que detecta conflictos de horarios y exámenes:
- `timeToMin(hhmm)`: Convierte hora a minutos.
- `hasExamConflict(materia, pId)`: Verifica si un paralelo tiene conflicto de examen.
- `plannerBuildCMap()`: Construye mapa de conflictos para todos los paralelos no seleccionados.
- `getConflictingMaterialsForParallel(materia, pId)`: Retorna lista de materias conflictivas.

### `src/ui/planner/planner-grid.js` — Renderizado de Grilla
Funciones de construcción y renderizado de la grilla de horarios:
- `plannerBuildGrid()`: Construye la estructura estática de columnas y líneas.
- `plannerClearBlocks()`: Elimina todos los bloques de eventos.
- `plannerDrawBlocks()`: Dibuja paralelos seleccionados en la grilla (clases o exámenes).

### `src/ui/planner/planner-ui.js` — Gestión del Estado y Panel Izquierdo
Gestión centralizada del estado y renderizado del panel izquierdo:
- `PlannerState`: Objeto global con estado (datos, selecciones, colores, colapso).
- `plannerRenderLeft()`: Construye acordeones del panel izquierdo.
- `updateLeftPanelState()`: Actualización incremental del estado visual.
- `plannerUpdateFooter()`: Actualiza contador de créditos y badge de conflictos.
- `plannerFullRefresh()`: Refresco completo (para cambios estructurales).
- `plannerRefresh()`: Refresco inteligente (incremental o completo según sea necesario).
- `plannerToggleCollapseAll()`: Toggle de colapso de todos los acordeones.
- `plannerApplyCalendarVisibility()`, `plannerToggleCalendar()`: Control de visibilidad del calendario.
- `plannerInitResizeObserver()`: Inicializa ResizeObserver para auto-ocultar al encoger.
- `persistSelection()`, `persistColorMap()`: Guardan estado en `chrome.storage`.

### `src/ui/planner/planner.js` — Orquestador del Planificador
Coordina la inicialización y gestiona las acciones principales:
- **Inicialización:** Carga datos desde `chrome.storage`, restaura selección y colores.
- **Listeners:** Enlaza eventos de botones (deseleccionar, colapsar, toggle calendario, etc.).
- **Sincronización:** Escucha cambios de almacenamiento y decide entre reconstrucción completa, actualización de detalles o refresco ligero.
- **Auto‑selección:** Algoritmo de backtracking aleatorio para encontrar combinaciones sin conflictos.

### CSS Modular (`src/shared/styles/`)
- **`variables.css`**: Centraliza los colores, bordes y tipografía usados en toda la extensión.
- **`base.css`**: Aplica un reset consistente y estilos base.
- **`buttons.css`**: Define variantes de botones reutilizables.
- **`modal.css`**: Estilos genéricos para overlays y modales.
- **`components.css`**: Componentes visuales compartidos (stepper, píldoras, tags).

---

## 4. Data Flow

El flujo de información sigue un modelo descentralizado basado en el almacenamiento local de Chrome:

1.  **Captura:** `content-scraper.js` extrae la información y la envía directamente a `chrome.storage.local`. No hay mensajería directa entre el script de contenido y la UI; el almacenamiento actúa como la "fuente de verdad".
2.  **Notificación Reactiva:** El Side Panel (`ui.js`) y el Planificador (`planner.js`) mantienen listeners activos sobre el almacenamiento. En cuanto los datos cambian, estas interfaces activan sus funciones de renderizado.
3.  **Gestión de Estado de UI:** Las preferencias visuales (colapso de tarjetas, créditos manuales) se guardan en el mismo objeto de datos, junto con metadatos como la selección del planner (`_selected`) y el mapa de colores (`_colorMap`).
4.  **Salida de Datos:** `exporter.js` (JSON) e `ics-exporter.js` (iCalendar) generan archivos descargables de forma local mediante Blobs. El planner también puede exportar la vista como imagen PNG.

---

## 5. Script Load Order (Critical)

Debido a que el proyecto no utiliza módulos de ES6, el orden de carga en los HTML es vital.

### Orden de carga en `src/ui/ui.html`

1.  `src/shared/utils.js` — Constantes globales y funciones matemáticas.
2.  `src/shared/storage.js` — Funciones de lectura/escritura.
3.  `src/shared/exporter.js` — Generación de archivos `.poli` (JSON).
4.  `src/shared/components/modal.js` — Componente `PBModal`.
5.  `src/ui/state.js` — Estado global `UIState` y persistencia visual.
6.  `src/ui/toasts.js` — Sistema de notificaciones.
7.  `src/ui/modals.js` — Diálogos modales (requiere `state.js` y `toasts.js`).
8.  `src/ui/cards.js` — Renderizado de tarjetas (requiere `state.js`, `toasts.js`, `modals.js`, `drag.js`).
9.  `src/ui/drag.js` — Funcionalidad drag & drop.
10. `src/ui/ui.js` — Orquestador (inicialización y listeners).

### Orden de carga en `src/ui/planner/planner.html`

1.  `src/shared/utils.js` — Constantes y funciones puras.
2.  `src/shared/storage.js` — Capa `chrome.storage`.
3.  `src/shared/ics-exporter.js` — Generación de archivos `.ics`.
4.  `src/shared/components/modal.js` — Componente `PBModal`.
5.  `src/shared/libs/html-to-image.min.js` — Librería de captura de imagen.
6.  `src/ui/planner/planner-conflicts.js` — Lógica de detección de conflictos.
7.  `src/ui/planner/planner-grid.js` — Renderizado de grilla.
8.  `src/ui/planner/planner-ui.js` — Gestión de estado y panel izquierdo.
9.  `src/ui/planner/planner.js` — Orquestador.

---

## 6. Multi-Browser Build

### Background scripts

The `src/background/` directory contains one self-contained service worker per platform. Each only handles the browser-specific entry point — all app logic stays in `ui/`, `shared/`, and `content/`.

### Platform manifests

`src/manifests/` holds three platform manifests:

| File | Target | Key differences |
|---|---|---|
| `manifest.chromium.json` | Chrome, Edge | MV3, `side_panel`, `sidePanel` permission |
| `manifest.opera.json` | Opera | MV3, no `side_panel`, `windows` permission only |
| `manifest.firefox.json` | Firefox | MV2, `sidebar_action`, `browser.*` API, `browser_specific_settings` |

**Loading the extension (development):**
Copy the target manifest to `src/manifest.json` before loading unpacked:

```bash
# Chromium / Chrome
cp src/manifests/manifest.chromium.json src/manifest.json

# Opera
cp src/manifests/manifest.opera.json src/manifest.json

# Firefox
cp src/manifests/manifest.firefox.json src/manifest.json
```

`src/manifest.json` is always the **active working copy** for the currently loaded build. The canonical sources live in `src/manifests/`.

### Platform scaffold directories

`src/platform/` is reserved for future platform-specific overrides beyond the background/manifest layer:

```
src/platform/
├── chromium/   # Chrome / Edge overrides
├── firefox/    # Firefox WebExtensions overrides
└── opera/      # Opera-specific overrides
```

---

## 7. Extension Permissions

- **`storage`**: Acceso persistente a los datos de planificación.
- **`sidePanel`**: Requerido para utilizar la API de panel lateral de Chrome.
- **`windows`**: Permite la creación de la ventana emergente del planificador.
- **`activeTab`**: Permite interactuar con la pestaña donde se abre el side panel.