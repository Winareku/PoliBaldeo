/* ============================================================
   Polibaldeo – popup.js  (Orquestador)
   Responsabilidad única: inicializar, cargar datos y enlazar
   listeners de botones. Toda la lógica de render vive en
   popup-ui.js; la lógica pura en shared/.
   ============================================================ */

(function() {
  "use strict";

  // ── Abrir Planner en ventana emergente ──────────────────────

  document.getElementById('btn-planner').onclick = function() {
    chrome.windows.create({
      url    : chrome.runtime.getURL('planner/planner.html'),
      type   : 'popup',
      width  : 1000,
      height : 700,
      focused: true
    });
  };

  // ── Exportar ─────────────────────────────────────────────────
  // Se exporta todo (sin filtro de selección) desde el Popup.

  document.getElementById('btn-export').onclick = function() {
    var exported = pbExportPoliFile(PopupState.currentData, null);
    if (!exported) {
      popupSetStatus('⚠️ No hay datos para exportar', 'warning');
    } else {
      popupSetStatus('✅ Exportado', 'success');
    }
  };

  // ── Borrar todo ───────────────────────────────────────────────

  document.getElementById('btn-clear').onclick = function() {
    if (confirm('¿Borrar todo?')) {
      pbClearData(function() {
        popupRender({});
      });
    }
  };

  // ── Escuchar cambios externos en storage ─────────────────────
  // (ej: content.js añade un paralelo mientras el popup está abierto)

  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local' && changes[PB_STORAGE_KEY] && !PopupState.isInternalChange) {
      popupRender(changes[PB_STORAGE_KEY].newValue);
    }
  });

  // ── Carga inicial ─────────────────────────────────────────────

  pbLoadData(function(data) {
    popupRender(data);
  });

})();
