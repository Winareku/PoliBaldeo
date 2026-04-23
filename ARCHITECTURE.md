# Polibaldeo — Architecture Reference

> **Target audience:** AI agents and developers onboarding to the codebase.  
> **Extension version:** 1.3.0 — Manifest V3, modular shared-script architecture.

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
    ├── content.js              # Script de contenido: Scraper de DOM e inyector
    ├── content.css             # Estilos para el botón inyectado y notificaciones
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
    │       └── modal.css       # Estilos para el modal genérico
    │
    ├── popup/                  # ── UI del Side Panel ──
    │   ├── popup.html          # Estructura HTML y orden de carga de scripts
    │   ├── popup.css           # Componentes visuales del popup
    │   ├── popup-layout.css    # Estructura de grid y dimensiones
    │   ├── popup-ui.js         # Renderizado de tarjetas de materias y paralelos
    │   └── popup.js            # Orquestador: listeners de botones e importación
    │
    └── planner/                # ── Ventana del Planificador ──
        ├── planner.html        # Estructura HTML de la cuadrícula
        ├── planner.css         # Componentes visuales del planner
        ├── planner-layout.css  # Estructura de paneles y grid
        ├── planner-ui.js       # Renderizado de cuadrícula, acordeones y conflictos
        ├── planner.js          # Orquestador: lógica de selección, filtros y vista de exámenes
        └── test.js             # Validación de lógica de conflictos (off-browser)
```

---

## 3. Module Map

### `src/background.js` — Service Worker
Funciona en segundo plano. Su única responsabilidad actual es escuchar el evento `onClicked` de la acción de la extensión para ejecutar `chrome.sidePanel.open`, abriendo la interfaz en la barra lateral del navegador.

### `src/content.js` — Captura de Datos
Se inyecta en el portal académico. Su función `extractData()` identifica el nombre de la materia, el paralelo (teórico o combinado con práctico), los profesores, las ubicaciones (aulas/bloques) y **los exámenes** (parcial, final, mejoramiento). Utiliza un `MutationObserver` para asegurar que el botón de captura se mantenga visible ante cambios dinámicos en el DOM.

### `src/shared/ics-exporter.js` — Exportación a Calendario
Módulo encargado de transformar la selección del usuario en un archivo `.ics` compatible con Google Calendar u Outlook.
- **Lógica de Recurrencia:** Utiliza `RRULE` para definir clases semanales durante un periodo determinado (por defecto 18 semanas).
- **Manejo de Fechas:** Calcula la primera ocurrencia de cada clase basándose en el índice del día (0-4 para Lunes-Viernes) y una fecha de inicio de semestre.

### `src/shared/components/modal.js` — Componente PBModal
Proporciona una API simple para crear modales dinámicos (`PBModal.create({ title, body, footer })`). Retorna un objeto con métodos `open()`, `close()`, `destroy()` y `getElement(selector)`. Elimina la necesidad de overlays hardcodeados en los HTML, mejorando la mantenibilidad y reduciendo la duplicación de código.

### `src/shared/libs/html-to-image.min.js` — Captura de imagen
Librería de terceros (html-to-image) utilizada para exportar la vista del horario como imagen PNG. Se emplea únicamente en el planner.

### `src/popup/popup.js` — Orquestador del Side Panel
Gestiona las acciones principales del panel lateral:
- **Importación:** Procesa archivos `.poli` en formato JSON (con fallback al formato de texto antiguo) parseando el texto para reconstruir el objeto de datos en el almacenamiento local.
- **Navegación:** Abre el planificador en una ventana popup optimizada (1000x700px).
- **Sincronización:** Escucha cambios en `chrome.storage.local` para refrescar la lista de materias si se añaden nuevos datos desde una pestaña.

### `src/planner/planner.js` — Orquestador del Planificador
Además de la lógica de selección y filtros, ahora incorpora:
- **Vista de exámenes:** Alterna entre la grilla de clases y una vista dedicada a los exámenes parciales (calculando el día de la semana a partir de la fecha).
- **Exportación a imagen:** Utiliza `html-to-image` para capturar el panel del horario y descargarlo como PNG.

### CSS Modular (`src/shared/styles/`)
- **`variables.css`**: Centraliza los colores, bordes y tipografía usados en toda la extensión.
- **`base.css`**: Aplica un reset consistente y estilos base para `html`, `body` y la clase `.sym`.
- **`buttons.css`**: Define variantes de botones (`.btn`, `.btn-primary`, `.btn-surface`, etc.) reutilizables.
- **`modal.css`**: Estilos genéricos para overlays y modales, compartidos por todos los diálogos de la extensión.

---

## 4. Data Flow (Explicación)

El flujo de información en Polibaldeo sigue un modelo descentralizado basado en el almacenamiento local de Chrome:

1.  **Captura:** Cuando el usuario interactúa con la página de ESPOL, `content.js` extrae la información (incluyendo exámenes) y la envía directamente a `chrome.storage.local`. No hay comunicación directa (mensajería) entre el script de contenido y la UI; el almacenamiento actúa como la "fuente de verdad".
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
4.  `src/shared/components/modal.js`: Componente `PBModal` (requerido por `popup-ui.js`).
5.  `src/popup/popup-ui.js`: Define el objeto de estado `PopupState` y las funciones de construcción de DOM.
6.  `src/popup/popup.js`: Ejecuta la inicialización, enlaza eventos y carga los datos iniciales.

### Orden de carga en `planner.html`

1.  `src/shared/utils.js`: Constantes y funciones puras.
2.  `src/shared/storage.js`: Capa `chrome.storage`.
3.  `src/shared/ics-exporter.js`: Generación de archivos `.ics`.
4.  `src/shared/components/modal.js`: Componente `PBModal` (usado por `planner.js` para el modal ICS).
5.  `src/shared/libs/html-to-image.min.js`: Librería de captura de imagen.
6.  `src/planner/planner-ui.js`: Define `PlannerState` y funciones de renderizado de grilla y acordeones.
7.  `src/planner/planner.js`: Orquestador: inicializa, enlaza botones y carga datos.

---

## 6. Extension Permissions

- **`storage`**: Acceso persistente a los datos de planificación.
- **`sidePanel`**: Requerido para utilizar la API de panel lateral de Chrome.
- **`windows`**: Permite la creación de la ventana emergente del planificador.
- **`activeTab`**: Permite interactuar con la pestaña donde se abre el side panel.
