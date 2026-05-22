/* ============================================================
   Polibaldeo – shared/storage.js
   Capa de datos estandarizada sobre chrome.storage.local.
   Requiere: utils.js (pbMatKeys, pbParKeys)
   ============================================================ */

"use strict";

var PB_STORAGE_KEY = 'polibaldeo_data';

/**
 * Lee los datos completos de chrome.storage.local.
 * @param {function(object):void} callback  Recibe el objeto data (nunca null).
 */
function pbLoadData(callback) {
  chrome.storage.local.get(PB_STORAGE_KEY, function(res) {
    var data = (res && res[PB_STORAGE_KEY] && typeof res[PB_STORAGE_KEY] === 'object')
      ? res[PB_STORAGE_KEY]
      : { _order: [] };
    callback(data);
  });
}

/**
 * Guarda el objeto data completo en chrome.storage.local.
 * @param {object}   data
 * @param {function=} callback  Opcional, llamado tras guardar.
 */
function pbSaveData(data, callback) {
  var payload = {};
  payload[PB_STORAGE_KEY] = data;
  chrome.storage.local.set(payload, function() {
    if (typeof callback === 'function') callback();
  });
}

/**
 * Borra completamente los datos de la extensión.
 * @param {function=} callback
 */
function pbClearData(callback) {
  chrome.storage.local.remove(PB_STORAGE_KEY, function() {
    if (typeof callback === 'function') callback();
  });
}

/**
 * Añade (o actualiza) un paralelo dentro de una materia y guarda.
 * Estructura del parámetro entry:
 *   { materia, paraleloId, horarios, info, creditos }
 * @param {object}   entry
 * @param {function=} callback  Llamado con (data) tras guardar.
 */
function pbAddEntry(entry, callback) {
  pbLoadData(function(data) {
    if (!data._order) data._order = [];

    // Crear nodo de materia si no existe
    if (!data[entry.materia]) {
      data[entry.materia] = {
        creditos : entry.creditos || '0',
        paralelos: {},
        _pOrder  : [],
        collapsed: false
      };
    }
    if (!data._order.includes(entry.materia)) {
      data._order.push(entry.materia);
    }

    // Añadir / sobreescribir paralelo
    data[entry.materia].paralelos[entry.paraleloId] = {
      horarios: entry.horarios,
      info    : entry.info
    };
    if (!data[entry.materia]._pOrder.includes(entry.paraleloId)) {
      data[entry.materia]._pOrder.push(entry.paraleloId);
    }

    pbSaveData(data, function() {
      if (typeof callback === 'function') callback(data);
    });
  });
}
