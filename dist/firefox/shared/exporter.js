/* ============================================================
   Polibaldeo – shared/exporter.js
   Fuente única de generación del archivo .poli (ahora JSON).
   Requiere: utils.js (pbMatKeys, pbParKeys)
   ============================================================ */

"use strict";

/**
 * Genera el contenido JSON del archivo .poli a partir de los
 * datos almacenados y un mapa opcional de selecciones del Planner.
 *
 * @param {object} data       Objeto completo de polibaldeo_data.
 * @param {object} [selected] Mapa { materia: paraleloId } del Planner
 *                            (si se pasa, sólo se exportan los paralelos
 *                            seleccionados; si es null/undefined se
 *                            exporta todo).
 * @returns {string}          Cadena JSON (UTF-8, con formato legible).
 */
function pbGeneratePoliContent(data, selected) {
  var exportData = data;
  
  if (selected && typeof selected === 'object') {
    exportData = { _order: [] };
    pbMatKeys(data).forEach(function(m) {
      var selPar = selected[m];
      if (!selPar) return;
      if (!exportData[m]) {
        exportData[m] = {
          creditos: data[m].creditos,
          paralelos: {},
          _pOrder: [],
          collapsed: data[m].collapsed
        };
      }
      exportData[m].paralelos[selPar] = data[m].paralelos[selPar];
      exportData[m]._pOrder.push(selPar);
      exportData._order.push(m);
    });
  }

  return JSON.stringify(exportData, null, 2);
}

/**
 * Dispara la descarga del archivo .poli en el navegador.
 *
 * @param {object} data       Objeto polibaldeo_data.
 * @param {object} [selected] Mapa de selecciones (Planner) o undefined (Popup).
 * @returns {boolean}         true si se exportó correctamente.
 */
function pbExportPoliFile(data, selected) {
  // Verificar que haya al menos una materia exportable
  var mks     = pbMatKeys(data);
  var hasData = mks.some(function(m) {
    if (selected) return !!selected[m];
    return true; // todas las materias si no hay selección
  });
  if (!hasData) return false;

  var content = pbGeneratePoliContent(data, selected);
  var blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'horario_' + new Date().toISOString().slice(0, 10) + '.poli';
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}