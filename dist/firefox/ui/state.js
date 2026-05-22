/* ============================================================
   Polibaldeo – ui/state.js
   Gestión del estado global del panel lateral (Side Panel).
   ============================================================ */

"use strict";

// ── Estado del panel de UI ────────────────────────────────────
var UIState = {
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
var uiColorMap = {};
var uiColorCtr = 0;

// ═══════════════════════════════════════════════════════════════
//  Persistencia desde la UI
// ═══════════════════════════════════════════════════════════════

function uiSaveVisualState() {
  UIState.isInternalChange = true;
  var newData = { _order: [] };

  // Preservar todas las claves que empiezan con "_" (excepto _order)
  var preservedKeys = {};
  Object.keys(UIState.currentData).forEach(function(k) {
    if (k.startsWith('_') && k !== '_order') {
      preservedKeys[k] = UIState.currentData[k];
    }
  });

  document.querySelectorAll('.materia-card').forEach(function(card) {
    var nombre    = card.dataset.materia;
    var cred      = card.querySelector('.creditos-value').textContent;
    var collapsed = card.classList.contains('collapsed');
    newData._order.push(nombre);
    newData[nombre] = { creditos: cred, paralelos: {}, _pOrder: [], collapsed: collapsed };

    card.querySelectorAll('.paralelo-item').forEach(function(item) {
      var pNum = item.dataset.paralelo;
      newData[nombre]._pOrder.push(pNum);
      var existingData = UIState.currentData[nombre] &&
                         UIState.currentData[nombre].paralelos &&
                         UIState.currentData[nombre].paralelos[pNum];
      if (existingData) {
        newData[nombre].paralelos[pNum] = existingData;
      }
    });
  });

  // Reincorporar las claves preservadas
  Object.keys(preservedKeys).forEach(function(k) {
    newData[k] = preservedKeys[k];
  });

  UIState.currentData = newData;
  pbSaveData(newData, function() {
    UIState.isInternalChange = false;
  });
}
