/* ============================================================
   Polibaldeo – shared/exporter.js
   Fuente única de generación del archivo .poli.
   Requiere: utils.js (pbMatKeys, pbParKeys)
   ============================================================ */

"use strict";

/**
 * Genera el contenido textual del archivo .poli a partir de los
 * datos almacenados y un mapa opcional de selecciones del Planner.
 *
 * @param {object} data       Objeto completo de polibaldeo_data.
 * @param {object} [selected] Mapa { materia: paraleloId } del Planner
 *                            (si se pasa, sólo se exportan los paralelos
 *                            seleccionados; si es null/undefined se
 *                            exporta todo).
 * @returns {string}          Contenido UTF-8 del archivo (con BOM).
 */
function pbGeneratePoliContent(data, selected) {
  var mks    = pbMatKeys(data);
  var blocks = [];

  mks.forEach(function(m) {
    var mat   = data[m];
    var pKeys = pbParKeys(mat);

    // Si hay selección, filtrar; de lo contrario exportar todos
    if (selected && typeof selected === 'object') {
      var selPar = selected[m];
      if (!selPar) return;               // materia sin selección → omitir
      pKeys = pKeys.filter(function(p) { return p === selPar; });
      if (!pKeys.length) return;
    }

    var lines = [m + '|' + (mat.creditos || '0')];
    pKeys.forEach(function(p) {
      var pd = mat.paralelos[p];
      if (!pd) return;
      var horariosStr = (pd.horarios || []).join('; ');
      var infoStr     = (pd.info     || '').replace(/\n/g, '\\n');
      lines.push(p + ' | ' + horariosStr + ' | 0 | ' + infoStr);
    });

    blocks.push(lines.join('\n'));
  });

  // BOM + bloques separados por línea en blanco
  return '\uFEFF' + blocks.join('\n\n');
}

/**
 * Dispara la descarga del archivo .poli en el navegador.
 *
 * @param {object} data       Objeto polibaldeo_data.
 * @param {object} [selected] Mapa de selecciones (Planner) o undefined (Popup).
 * @returns {boolean}         false si no había datos que exportar.
 */
function pbExportPoliFile(data, selected) {
  var content = pbGeneratePoliContent(data, selected);
  // Tras quitar el BOM, si sólo queda espacio → sin datos
  if (!content.replace('\uFEFF', '').trim()) return false;

  var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  var a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'horario_' + new Date().toISOString().slice(0, 10) + '.poli';
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
