/* ============================================================
   Polibaldeo – planner.js  (Orquestador)
   Responsabilidad única: inicializar, cargar datos y enlazar
   listeners de botones. Toda la lógica de render vive en
   planner-ui.js; la lógica pura en shared/.
   ============================================================ */

(function() {
  "use strict";

  // ── Inicialización ──────────────────────────────────────────

  function init() {
    pbLoadData(function(data) {
      PlannerState.data = data;
      plannerBuildGrid();
      plannerRefresh();
      plannerInitResizeObserver();   // auto-ocultar calendario al redimensionar
      plannerApplyCalendarVisibility(); // estado inicial
    });
  }

  // ── Botones de header ───────────────────────────────────────

  document.getElementById('btn-deselect-all').onclick = function() {
    PlannerState.selected = {};
    plannerRefresh();
  };

  // Colapsar / Expandir (toggle)
  document.getElementById('btn-collapse-all').onclick = plannerToggleCollapseAll;

  // Descargar .ics
  document.getElementById('btn-export-ics').onclick = function() {
    var ok = pbExportICSFile(PlannerState.data, PlannerState.selected);
    if (!ok) {
      // Toast visual si no hay selección
      var badge = document.getElementById('conflict-badge');
      if (badge) {
        var prev = badge.textContent;
        badge.textContent = '⚠ Selecciona al menos un paralelo';
        badge.classList.add('show');
        setTimeout(function() {
          badge.textContent = prev;
          badge.classList.remove('show');
        }, 2500);
      }
    }
  };

  // Mostrar / Ocultar calendario
  document.getElementById('btn-toggle-calendar').onclick = plannerToggleCalendar;

  // ── Arranque ─────────────────────────────────────────────────

  init();

})();

