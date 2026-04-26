/* ============================================================
   Polibaldeo – planner/planner-conflicts.js
   Lógica de detección de conflictos de horarios y exámenes.
   Depende de: PlannerState (desde planner-ui.js)
   ============================================================ */

"use strict";

/**
 * Convierte una hora en formato HH:MM a minutos desde medianoche.
 * @param {string} hhmm - Hora en formato HH:MM
 * @returns {number}
 */
function timeToMin(hhmm) {
  var parts = hhmm.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

/**
 * Verifica si el paralelo (materia, pId) tiene conflictos de examen
 * con los paralelos ya seleccionados.
 * @param {string} materia
 * @param {string} pId
 * @returns {boolean}
 */
function hasExamConflict(materia, pId) {
  var data = PlannerState.data;
  var mat = data[materia];
  if (!mat || !mat.paralelos || !mat.paralelos[pId]) return false;
  var candidateExams = mat.paralelos[pId].examenes || {};
  
  var selectedExams = [];
  Object.keys(PlannerState.selected).forEach(function(sm) {
    var spId = PlannerState.selected[sm];
    if (sm === materia) return;   // ignorar completamente la misma materia
    var sp = data[sm] && data[sm].paralelos[spId];
    if (sp && sp.examenes) {
      Object.keys(sp.examenes).forEach(function(ek) {
        selectedExams.push(sp.examenes[ek]);
      });
    }
  });
  
  return Object.keys(candidateExams).some(function(ck) {
    var cex = candidateExams[ck];
    if (!cex || !cex.fecha) return false;
    return selectedExams.some(function(sex) {
      if (!sex || !sex.fecha) return false;
      if (cex.fecha !== sex.fecha) return false;
      var cStart = timeToMin(cex.inicio);
      var cEnd = timeToMin(cex.fin);
      var sStart = timeToMin(sex.inicio);
      var sEnd = timeToMin(sex.fin);
      return cStart < sEnd && cEnd > sStart;
    });
  });
}

/**
 * Construye un mapa { "materia|paralelo": boolean } indicando si
 * cada paralelo no seleccionado conflictúa con la selección actual.
 */
function plannerBuildCMap() {
  var mks      = pbMatKeys(PlannerState.data);
  var selSlots = {};

  mks.forEach(function(m) {
    var p = PlannerState.selected[m];
    if (p) {
      selSlots[m] = pbParseH(PlannerState.data[m].paralelos[p].horarios);
    }
  });

  var cmap = {};
  mks.forEach(function(m) {
    var mat = PlannerState.data[m];
    if (!mat || !mat.paralelos) return;
    Object.keys(mat.paralelos).forEach(function(p) {
      var slots    = pbParseH(mat.paralelos[p].horarios);
      var conflict = false;
      Object.keys(selSlots).forEach(function(sm) {
        if (!conflict && sm !== m && pbOverlaps(slots, selSlots[sm])) {
          conflict = true;
        }
      });
      if (!conflict) {
        conflict = hasExamConflict(m, p);
      }
      cmap[m + '|' + p] = conflict;
    });
  });

  return cmap;
}

/**
 * Devuelve un arreglo de objetos con los nombres y tipos de conflicto
 * de las materias seleccionadas que conflictúan con el paralelo (materia, pId).
 * @param {string} materia 
 * @param {string} pId 
 * @returns {Array} array de { name, type }
 */
function getConflictingMaterialsForParallel(materia, pId) {
  var data = PlannerState.data;
  var mat = data[materia];
  if (!mat || !mat.paralelos || !mat.paralelos[pId]) return [];
  var slots = pbParseH(mat.paralelos[pId].horarios);
  var conflicts = [];  // { name, type }

  Object.keys(PlannerState.selected).forEach(function(sm) {
    if (sm === materia) return;
    var selPId = PlannerState.selected[sm];
    if (!selPId) return;
    var selData = data[sm];
    if (!selData || !selData.paralelos || !selData.paralelos[selPId]) return;
    
    // Conflicto de horarios de clase
    var selSlots = pbParseH(selData.paralelos[selPId].horarios);
    if (pbOverlaps(slots, selSlots)) {
      conflicts.push({ name: sm, type: 'clases' });
      return;
    }
    
    // Conflicto de exámenes
    var candidateExams = mat.paralelos[pId].examenes || {};
    var selectedExams = selData.paralelos[selPId].examenes || {};
    var conflictExam = Object.keys(candidateExams).some(function(ck) {
      var cex = candidateExams[ck];
      if (!cex || !cex.fecha) return false;
      return Object.keys(selectedExams).some(function(sk) {
        var sex = selectedExams[sk];
        if (!sex || !sex.fecha) return false;
        if (cex.fecha !== sex.fecha) return false;
        var cStart = timeToMin(cex.inicio);
        var cEnd = timeToMin(cex.fin);
        var sStart = timeToMin(sex.inicio);
        var sEnd = timeToMin(sex.fin);
        return cStart < sEnd && cEnd > sStart;
      });
    });
    if (conflictExam) conflicts.push({ name: sm, type: 'examen' });
  });

  return conflicts;
}
