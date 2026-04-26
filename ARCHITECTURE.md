# Polibaldeo — Architecture Reference

> **Target audience:** AI agents and developers onboarding to the codebase.

---

## 1. Project Overview

Polibaldeo es una extensión de Chrome diseñada para asistir a los estudiantes de la **ESPOL** (Escuela Superior Politécnica del Litoral) durante el proceso de matriculación. Opera exclusivamente en el portal académico de la universidad y ofrece dos capacidades principales:

1.  **Capture (Captura):** Un script de contenido inyecta un botón en la página de detalles de la materia. Al hacer clic, extrae los datos de horarios del paralelo, los exámenes (parcial, final, mejoramiento), el profesor y la ubicación, y los persiste en `chrome.storage.local`.
2.  **Plan & Organize (Planificación):** Un panel lateral (Side Panel) y una ventana de planificador independiente leen los datos almacenados, renderizan una cuadrícula de horarios semanal, detectan conflictos de tiempo (incluyendo solapamiento de exámenes), permiten alternar entre la vista de clases y la vista de exámenes, exportar la selección a imagen PNG o a calendario, y gestionar los datos mediante importación/exportación en formato JSON.

### Chrome APIs used

| API | Why |
|---|---|
| `chrome.storage.local` | Persiste los datos de materias/paralelos. Accesible desde scripts de contenido, el service worker y las páginas de la extensión. |
| `chrome.sidePanel` | Mantiene la interfaz de usuario de la extensión abierta de forma persistente en la barra lateral mientras el usuario navega por el portal. |
| `chrome.action` | Escucha los clics en el icono de la barra de herramientas para abrir el Side Panel. |
| `chrome.windows.create()` | Abre el planificador principal como una ventana emergente dedicada (no una pestaña) para separar la UI de planificación del contexto de navegación. |
| `chrome.storage.onChanged` | Permite que la UI se actualice automáticamente cuando el script de contenido registra un nuevo paralelo. |

---

## 2. File Tree

```text
polibaldeo/
├── ARCHITECTURE.md             # Este documento
├── README.md                   # Documentación del proyecto
├── src/                        # ── Código Fuente ──
    ├── manifest.json           # Manifiesto de la extensión (MV3)
    ├── background.js           # Service Worker: Inicializa el Side Panel
    │
    ├── content/                # ── Script de contenido ──
    │   ├── content-scraper.js  # Lógica de extracción de datos
    │   ├── content-navigator.js# Navegador de paralelos y botón de captura
    │   └── content.css         # Estilos para el botón y navegador de paralelos
    │
    ├── icons/                  # Iconos de la extensión
    │
    ├── shared/                 # ── Módulos compartidos (sin dependencia de DOM) ──
    │   ├── utils.js            # Funciones puras: matemáticas de tiempo, paleta de colores
    │   ├── storage.js          # Capa de abstracción de chrome.storage.local
    │   ├── exporter.js         # Generación de archivos .poli (JSON)
    │   ├── ics-exporter.js     # Generación de archivos iCalendar (.ics)
    │   │
    │   ├── components/         # ── Componentes UI reutilizables ──
    │   │   └── modal.js        # Componente PBModal para crear modales dinámicos
    │   │
    │   ├── libs/               # ── Librerías de terceros ──
    │   │   └── html-to-image.min.js  # Captura de HTML a imagen PNG
    │   │
    │   └── styles/             # ── Hojas de estilo modulares ──
    │       ├── variables.css   # Variables globales de color y tipografía
    │       ├── base.css        # Reset y estilos base
    │       ├── buttons.css     # Componentes de botones reutilizables
    │       ├── modal.css       # Estilos para el modal genérico
    │       └── components.css  # Componentes visuales compartidos (stepper, píldoras, tags)
    │
    ├── popup/                  # ── UI del Side Panel ──
    │   ├── popup.html          # Estructura HTML y orden de carga de scripts
    │   ├── popup.css           # Componentes visuales del popup
    │   ├── popup-layout.css    # Estructura de grid y dimensiones
    │   ├── popup-state.js      # Gestión del estado global (PopupState, EditModalState)
    │   ├── popup-toasts.js     # Sistema de notificaciones tipo toast
    │   ├── popup-modals.js     # Diálogos modales (edición de paralelos, materias)
    │   ├── popup-cards.js      # Renderizado de tarjetas de materias y paralelos
    │   ├── popup-drag.js       # Funcionalidad de drag & drop
    │   └── popup.js            # Orquestador: listeners de botones e importación
    │
    └── planner/                # ── Ventana del Planificador ──
        ├── planner.html        # Estructura HTML de la cuadrícula
        ├── planner.css         # Componentes visuales del planner
        ├── planner-layout.css  # Estructura de paneles y grid
        ├── planner-conflicts.js# Lógica de detección de conflictos (horarios y exámenes)
        ├── planner-grid.js     # Renderizado de la grilla de horarios
        ├── planner-ui.js       # Gestión de estado y panel izquierdo (acordeones)
        ├── planner.js          # Orquestador: lógica de selección y botones
        └── test.js             # Validación de lógica de conflictos (off-browser)
```

---

## 3. Module Map

### `src/background.js` — Service Worker
Funciona en segundo plano. Su única responsabilidad actual es escuchar el evento `onClicked` de la acción de la extensión para ejecutar `chrome.sidePanel.open`, abriendo la interfaz en la barra lateral del navegador.

### `src/content/content-scraper.js` — Captura de Datos
Se inyecta en el portal académico. Contiene las funciones `parseExamInfo`, `_extractData`, `saveData`, `showToast` y `captureData`. Extrae horarios, profesor, ubicación y exámenes, y persiste los datos en `chrome.storage.local`.

### `src/content/content-navigator.js` — Interfaz de Navegación
Inyecta el botón "Añadir a Polibaldeo" y un navegador de paralelos estilo Material 3. Utiliza un `MutationObserver` para garantizar su persistencia ante cambios dinámicos del DOM.

### `src/shared/ics-exporter.js` — Exportación a Calendario
Módulo encargado de transformar la selección del usuario en un archivo `.ics` compatible con Google Calendar u Outlook.
- **Lógica de Recurrencia:** Utiliza `RRULE` para definir clases semanales durante un periodo determinado (por defecto 18 semanas).
- **Manejo de Fechas:** Calcula la primera ocurrencia de cada clase basándose en el índice del día (0-4 para Lunes-Viernes) y una fecha de inicio de semestre.

### `src/shared/components/modal.js` — Componente PBModal
Proporciona una API simple para crear modales dinámicos (`PBModal.create({ title, body, footer })`). Retorna un objeto con métodos `open()`, `close()`, `destroy()` y `getElement(selector)`. Elimina la necesidad de overlays hardcodeados en los HTML, mejorando la mantenibilidad y reduciendo la duplicación de código.

### `src/popup/popup-state.js` — Gestión de Estado
Define las variables globales de estado del panel:
- `PopupState`: Objeto con `currentData` (materias y paralelos) e `isInternalChange` (flag de sincronización).
- `EditModalState`: Contexto para el modal de edición de paralelos.
- `popupColorMap` y `popupColorCtr`: Mapeo de colores de la paleta para cada materia.
- `popupSaveVisualState()`: Persiste el estado visual (orden, créditos, estado colapsado) en el almacenamiento.

### `src/popup/popup-toasts.js` — Sistema de Notificaciones
Implementa un sistema de toasts para notificaciones al usuario:
- `popupSetStatus(msg, type)`: Muestra notificaciones simples (success, warning, info).
- `pbShowUndoToast(msg, undoFn)`: Muestra notificaciones con acción de "Deshacer".
- `_removeToastEntry()`: Gestiona la limpieza de toasts.

### `src/popup/popup-modals.js` — Diálogos Modales
Contiene todos los modales de la interfaz:
- `pbConfirm(msg, onOk, onCancel)`: Modal genérico de confirmación.
- `popupOpenEditModal(materia, pId, isNew)`: Modal para editar/crear paralelos (horarios, profesor, ubicación, exámenes).
- `popupOpenMateriaModal()`: Modal para crear nuevas materias.
- `popupStartNameEdit(nameEl, card)`: Edición inline del nombre de materia.
- Helpers: `pbParseHorarioStr()`, `pbParseInfo()`, `pbBuildInfo()`, `_pbNextParId()`.

### `src/popup/popup-cards.js` — Renderizado de UI
Funciones de construcción y renderizado de elementos DOM:
- `popupRender(data)`: Punto de entrada principal, renderiza la lista de materias.
- `popupBuildMateriaCard(nombre, mat)`: Crea la tarjeta de una materia con controles.
- `popupBuildParaleloItem(nombreMateria, nParalelo, data, parentList)`: Crea un item de paralelo.
- `popupToggleCollapseAll()`: Alterna el estado colapsado de todas las materias.
- `popupUpdateCounter()`: Actualiza el contador de materias en el header.

### `src/popup/popup-drag.js` — Drag & Drop
Implementa la funcionalidad de arrastrar y soltar:
- `pbInitDragHandle(handleEl, itemEl, containerEl, onDrop)`: Inicializa drag & drop para reordenar elementos.

### `src/popup/popup.js` — Orquestador del Side Panel
Gestiona las acciones principales del panel lateral:
- **Importación:** Procesa archivos `.poli` en formato JSON (con fallback al formato de texto antiguo) parseando el texto para reconstruir el objeto de datos en el almacenamiento local.
- **Navegación:** Abre el planificador en una ventana popup optimizada (1000x700px).
- **Sincronización:** Escucha cambios en `chrome.storage.local` para refrescar la lista de materias si se añaden nuevos datos desde una pestaña.

### `src/planner/planner-conflicts.js` — Lógica de Conflictos
Módulo que detecta conflictos de horarios y exámenes:
- `timeToMin(hhmm)`: Convierte hora a minutos.
- `hasExamConflict(materia, pId)`: Verifica si un paralelo tiene conflicto de examen.
- `plannerBuildCMap()`: Construye mapa de conflictos para todos los paralelos no seleccionados.
- `getConflictingMaterialsForParallel(materia, pId)`: Retorna lista de materias conflictivas.

### `src/planner/planner-grid.js` — Renderizado de Grilla
Funciones de construcción y renderizado de la grilla de horarios:
- `plannerBuildGrid()`: Construye la estructura estática de columnas y líneas.
- `plannerClearBlocks()`: Elimina todos los bloques de eventos.
- `plannerDrawBlocks()`: Dibuja paralelos seleccionados en la grilla (clases o exámenes).
- `plannerDrawExamBlocks()`: Dibuja específicamente los exámenes parciales.

### `src/planner/planner-ui.js` — Gestión del Estado y Panel Izquierdo
Gestión centralizada del estado y renderizado del panel izquierdo:
- `PlannerState`: Objeto global con estado (datos, selecciones, colores, colapso).
- `getAccordions()`, `getAccordionByMateria()`, `getParaleloItems()`: Utilidades DOM.
- `plannerRenderLeft()`: Construye acordeones del panel izquierdo.
- `updateLeftPanelState()`: Actualización incremental del estado visual.
- `plannerUpdateFooter()`: Actualiza contador de créditos y badge de conflictos.
- `plannerFullRefresh()`: Refresco completo (para cambios estructurales).
- `plannerRefresh()`: Refresco inteligente (incremental o completo según sea necesario).
- `plannerToggleCollapseAll()`: Toggle de colapso de todos los acordeones.
- `plannerApplyCalendarVisibility()`, `plannerToggleCalendar()`: Control de visibilidad del calendario.
- `plannerInitResizeObserver()`: Inicializa ResizeObserver para auto-ocultar al encoger.

### `src/planner/planner.js` — Orquestador del Planificador
Coordina la inicialización y gestiona las acciones principales:
- **Inicialización:** Carga datos desde `chrome.storage` y construye la interfaz.
- **Listeners:** Enlaza eventos de botones (deseleccionar, colapsar, toggle calendario, etc.).
- **Sincronización:** Escucha cambios de almacenamiento para actualizar la vista.
- **Modos:** Maneja vista de clases vs. vista de exámenes.
- **Exportación:** Integración con `ics-exporter.js` y `html-to-image` para descargar datos.

### CSS Modular (`src/shared/styles/`)
- **`variables.css`**: Centraliza los colores, bordes y tipografía usados en toda la extensión.
- **`base.css`**: Aplica un reset consistente y estilos base para `html`, `body` y la clase `.sym`.
- **`buttons.css`**: Define variantes de botones (`.btn`, `.btn-primary`, `.btn-surface`, etc.) reutilizables.
- **`modal.css`**: Estilos genéricos para overlays y modales, compartidos por todos los diálogos de la extensión.
- **`components.css`**: Componentes visuales compartidos (stepper de créditos, píldoras, tags de horarios y exámenes). Evita la duplicación entre popup y planner.

---

## 4. Data Flow (Explicación)

El flujo de información en Polibaldeo sigue un modelo descentralizado basado en el almacenamiento local de Chrome:

1.  **Captura:** Cuando el usuario interactúa con la página de ESPOL, `content-scraper.js` extrae la información (incluyendo exámenes) y la envía directamente a `chrome.storage.local`. No hay comunicación directa (mensajería) entre el script de contenido y la UI; el almacenamiento actúa como la "fuente de verdad".
2.  **Notificación Reactiva:** El Side Panel (`popup.js`) y el Planificador (`planner.js`) mantienen listeners activos sobre el almacenamiento. En cuanto los datos cambian, estas interfaces activan sus funciones de renderizado para mostrar la nueva materia o paralelo sin necesidad de recargar.
3.  **Gestión de Estado de UI:** Las preferencias visuales, como si una tarjeta de materia está colapsada o el número de créditos asignado manualmente, se guardan en el mismo objeto de datos para asegurar que la experiencia sea consistente entre el panel lateral y el planificador.
4.  **Salida de Datos:** Para la exportación, los módulos `exporter.js` (JSON) e `ics-exporter.js` (iCalendar) toman el estado actual del almacenamiento y las selecciones activas en el planificador para generar archivos descargables de forma local mediante Blobs de JavaScript. Adicionalmente, el planner puede exportar la vista como imagen PNG.

---

## 5. Script Load Order (Critical)

Debido a que el proyecto no utiliza módulos de ES6, el orden de carga en `popup.html` y `planner.html` es vital para evitar errores de referencia.

### Orden de carga en `popup.html`

1.  `src/shared/utils.js`: Define constantes globales y funciones matemáticas.
2.  `src/shared/storage.js`: Proporciona las funciones de lectura/escritura.
3.  `src/shared/exporter.js`: Funciones de generación de archivos `.poli` (JSON).
4.  `src/shared/components/modal.js`: Componente `PBModal` (requerido por los modales).
5.  `src/popup/popup-state.js`: Estado global y persistencia visual.
6.  `src/popup/popup-toasts.js`: Sistema de notificaciones.
7.  `src/popup/popup-modals.js`: Diálogos modales (requiere popup-state.js y popup-toasts.js).
8.  `src/popup/popup-cards.js`: Renderizado de tarjetas (requiere popup-state.js, popup-toasts.js, popup-modals.js, popup-drag.js).
9.  `src/popup/popup-drag.js`: Funcionalidad drag & drop.
10. `src/popup/popup.js`: Orquestador (inicialización y listeners).

### Orden de carga en `planner.html`

1.  `src/shared/utils.js`: Constantes y funciones puras.
2.  `src/shared/storage.js`: Capa `chrome.storage`.
3.  `src/shared/ics-exporter.js`: Generación de archivos `.ics`.
4.  `src/shared/components/modal.js`: Componente `PBModal` (usado por `planner.js`).
5.  `src/shared/libs/html-to-image.min.js`: Librería de captura de imagen.
6.  `src/planner/planner-conflicts.js`: Lógica de detección de conflictos.
7.  `src/planner/planner-grid.js`: Renderizado de grilla (requiere planner-conflicts.js).
8.  `src/planner/planner-ui.js`: Gestión de estado y panel izquierdo (requiere planner-conflicts.js, planner-grid.js).
9.  `src/planner/planner.js`: Orquestador: inicializa, enlaza botones y carga datos.

---

## 6. Extension Permissions

- **`storage`**: Acceso persistente a los datos de planificación.
- **`sidePanel`**: Requerido para utilizar la API de panel lateral de Chrome.
- **`windows`**: Permite la creación de la ventana emergente del planificador.
- **`activeTab`**: Permite interactuar con la pestaña donde se abre el side panel.