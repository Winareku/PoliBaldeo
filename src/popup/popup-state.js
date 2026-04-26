/* ============================================================
   Polibaldeo – popup/popup-state.js
   Gestión del estado global del popup.
   ============================================================ */

"use strict";

// ── Estado del Popup ─────────────────────────────────────────
var PopupState = {
  currentData     : {},
  isInternalChange: false
};

// ── Estado del modal de edición ───────────────────────────────
var EditModalState = {
  materia : null,
  oldPId  : null,
  isNew   : false
};

// Mapa de colores para materias (consistente con planner)
var popupColorMap = {};
var popupColorCtr = 0;

// ═══════════════════════════════════════════════════════════════
//  Persistencia desde la UI
// ═══════════════════════════════════════════════════════════════

function popupSaveVisualState() {
  PopupState.isInternalChange = true;
  var newData = { _order: [] };

  document.querySelectorAll('.materia-card').forEach(function(card) {
    var nombre    = card.dataset.materia;
    var cred      = card.querySelector('.creditos-value').textContent;
    var collapsed = card.classList.contains('collapsed');
    newData._order.push(nombre);
    newData[nombre] = { creditos: cred, paralelos: {}, _pOrder: [], collapsed: collapsed };

    card.querySelectorAll('.paralelo-item').forEach(function(item) {
      var pNum = item.dataset.paralelo;
      newData[nombre]._pOrder.push(pNum);
      var existingData = PopupState.currentData[nombre] &&
                         PopupState.currentData[nombre].paralelos &&
                         PopupState.currentData[nombre].paralelos[pNum];
      if (existingData) {
        newData[nombre].paralelos[pNum] = existingData;
      }
    });
  });

  PopupState.currentData = newData;
  pbSaveData(newData, function() {
    PopupState.isInternalChange = false;
  });
}
