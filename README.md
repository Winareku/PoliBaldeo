# PoliBaldeo - Planificación de Horarios

<p align="center">
  <img src="assets/PoliBaldeo_LogoBanner.png" alt="Banner"/>
</p>

**PoliBaldeo** es una extensión de Chrome diseñada para simplificar el proceso de matriculación de los estudiantes de la **ESPOL**. Permite capturar la oferta académica directamente desde el portal universitario y organizar horarios sin conflictos de forma visual y eficiente.

## 🚀 Características Principales

  - **Captura Inteligente**: Inyecta un botón "Añadir" directamente en el detalle de las materias del portal académico para extraer datos de horarios automáticamente.
  - **Planificador Visual (Planner)**: Interfaz dedicada con una rejilla semanal para visualizar la carga académica.
  - **Detección de Conflictos**: Sistema automático que identifica y resalta cruces de horarios entre paralelos seleccionados, mostrando además las materias conflictivas.
  - **Zero-Backend**: Los datos se gestionan localmente en el navegador mediante `chrome.storage.local`, garantizando privacidad y rapidez.
  - **Exportación Versátil**:
      - Genera archivos `.poli` para el uso en la versión Legacy (Python).
      - Exporta a formato iCalendar (`.ics`) para sincronizar con Google Calendar, Outlook o Apple Calendar.
  - **Interfaz Material 3 Dark**: Diseño oscuro moderno con paleta de colores consistente, toasts unificados y modales dinámicos.
  - **Toasts unificados**: Notificaciones visuales con botón de cierre y opción de deshacer.
  - **Colores por materia**: Cada materia tiene un color distintivo en el popup y el planner, siguiendo una paleta armonizada.

## 🛠️ Instalación (Modo Desarrollador)

Actualmente, la extensión se puede instalar cargando el código fuente directamente en Chrome:

1.  Descarga o clona este repositorio:
    ```bash
    git clone https://github.com/Winareku/PoliBaldeo.git
    ```
2.  Abre tu navegador y ve a `chrome://extensions/`.
3.  Activa el **"Modo de desarrollador"** en la esquina superior derecha.
4.  Haz clic en el botón **"Cargar extensión sin empaquetar"**.
5.  Selecciona la carpeta raíz del proyecto.

## 📂 Arquitectura del Proyecto

La extensión utiliza una arquitectura modular de scripts compartidos (Vanilla JS) sin dependencias externas (sin Webpack, React o jQuery), optimizada para el **Manifest V3**.

### Estructura de Archivos:

  - `shared/`: Lógica persistente y utilitarios puros (almacenamiento, exportadores, constantes).
    - `styles/`: Hojas de estilo modulares (variables, base, botones, modal).
    - `components/`: Componentes UI reutilizables (modal dinámico).
  - `content/`: Script inyectado en el portal académico para el raspado de datos (Scraping).
  - `planner/`: Interfaz y lógica del orquestador de horarios (HTML, CSS, JS).
  - `popup/`: Menú rápido de la extensión para acceso directo al Planner y gestión de datos (HTML, CSS, JS).

### Orden de Carga Crítico:

Para garantizar la disponibilidad de variables globales, los scripts siguen este orden estricto:

1.  `utils.js` (Constantes)
2.  `storage.js` (Capa de persistencia)
3.  `exporter.js` / `ics-exporter.js` (Lógica de archivos)
4.  `modal.js` (Componente de modales)
5.  `*-ui.js` (Renderizado de interfaz)
6.  `*.js` (Orquestador y listeners)

## 🤝 Contribuciones

1.  Haz un fork del repositorio.
2.  Crea una rama para tu mejora (`git checkout -b feature/Mejora`).
3.  Realiza tus cambios y haz commit (`git commit -m 'Añade una mejora'`).
4.  Sube la rama (`git push origin feature/Mejora`).
5.  Abre un Pull Request.

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - consulta el archivo `LICENSE` para más detalles.

## 🎨 Attributions

Este proyecto utiliza los siguientes recursos de terceros, cuyas licencias son compatibles con la licencia MIT del proyecto:

- **Plus Jakarta Sans** – Fuente tipográfica  
  Copyright 2020 The Plus Jakarta Sans Project Authors.  
  Licencia: [SIL Open Font License 1.1](https://scripts.sil.org/OFL)

- **Material Symbols** – Íconos  
  Copyright Google Inc.  
  Licencia: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

## 📮 Soporte

Si encuentras algún error en el raspado de datos o tienes sugerencias para el planificador, por favor abre un "issue" en el repositorio de GitHub.

## 📷 Screenshots

<p align="center">
  <img src="assets/PoliBaldeo_Screenshot_01.png" alt="Screenshot_01"/>
</p>

<p align="center">
  <img src="assets/PoliBaldeo_Screenshot_02.png" alt="Screenshot_02"/>
</p>
