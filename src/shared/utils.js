/* ============================================================
   Polibaldeo – shared/utils.js
   Lógica pura: constantes, matemáticas de tiempo, parsing de
   horarios y detección de solapamientos.
   NO depende de DOM, chrome.* ni ningún otro módulo.
   ============================================================ */

"use strict";

// ── Constantes de grilla ────────────────────────────────────
var PB_GRID_SH    = 7;          // Hora de inicio de la grilla
var PB_GRID_EH    = 22;         // Hora de fin
var PB_TOTAL_H    = PB_GRID_EH - PB_GRID_SH; // 15 horas
var PB_HOUR_PX    = 40;         // Píxeles por hora
var PB_MIN_PX     = PB_HOUR_PX / 60;
var PB_GRID_PX    = PB_TOTAL_H * PB_HOUR_PX;

// ── Mapa de días ────────────────────────────────────────────
var PB_DAY_MAP = {
  'Lunes'    : 0,
  'Martes'   : 1,
  'Miércoles': 2,
  'Jueves'   : 3,
  'Viernes'  : 4
};

// ── Paleta de colores (Material 3 Dark) ─────────────────────
var PB_PALETTE = [
  { bg:'rgba(0,72,128,.22)',  fg:'#9ecaff', ac:'#4d9cff', dot:'#4d9cff' },
  { bg:'rgba(0,57,20,.28)',   fg:'#6dd58c', ac:'#4caf65', dot:'#6dd58c' },
  { bg:'rgba(33,0,93,.28)',   fg:'#cebdff', ac:'#a07fff', dot:'#bb9eff' },
  { bg:'rgba(44,21,0,.28)',   fg:'#ffb878', ac:'#ff8c2a', dot:'#ffb870' },
  { bg:'rgba(0,31,37,.32)',   fg:'#80d6e8', ac:'#30b8d8', dot:'#7ad4e8' },
  { bg:'rgba(59,9,8,.28)',    fg:'#ffb4ab', ac:'#ff5449', dot:'#ffb4ab' },
  { bg:'rgba(20,30,0,.28)',   fg:'#b8d885', ac:'#78b830', dot:'#b8d885' },
  { bg:'rgba(41,0,51,.28)',   fg:'#e8aeff', ac:'#cc60ff', dot:'#e0a0ff' },
  { bg:'rgba(44,32,0,.28)',   fg:'#ffd878', ac:'#d4a800', dot:'#ffd070' },
  { bg:'rgba(0,32,37,.28)',   fg:'#80ece0', ac:'#30ccc0', dot:'#80ece0' },
];

// ── Funciones de tiempo ─────────────────────────────────────

/**
 * Convierte "HH:MM" (o "HH:MM:SS") a minutos relativos al inicio de la grilla.
 * @param {string} s
 * @returns {number}
 */
function pbTimeToMin(s) {
  var parts = s.split(':').map(Number);
  return (parts[0] - PB_GRID_SH) * 60 + (parts[1] || 0);
}

/**
 * Parsea un array de strings de horario y devuelve objetos de slot.
 * Formato esperado: "Lunes 07:00-09:00" o "Miércoles 10:00:00-12:00:00"
 * @param {string[]} horarios
 * @returns {Array<{di:number, s:number, e:number, raw:string}>}
 */
function pbParseH(horarios) {
  return (horarios || []).flatMap(function(h) {
    var m = h.match(
      /([A-ZÁÉÍÓÚa-záéíóúü]+)\s+(\d{2}:\d{2}(?::\d{2})?)-(\d{2}:\d{2}(?::\d{2})?)/u
    );
    if (!m) return [];
    var di = PB_DAY_MAP[m[1]];
    if (di === undefined) return [];
    var s = pbTimeToMin(m[2]);
    var e = pbTimeToMin(m[3]);
    if (s >= e || s < 0 || e > PB_TOTAL_H * 60) return [];
    return [{ di: di, s: s, e: e, raw: h }];
  });
}

/**
 * Devuelve true si algún slot de 'a' solapa con algún slot de 'b'.
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 */
function pbOverlaps(a, b) {
  for (var i = 0; i < a.length; i++) {
    for (var j = 0; j < b.length; j++) {
      if (a[i].di === b[j].di && a[i].s < b[j].e && a[i].e > b[j].s) {
        return true;
      }
    }
  }
  return false;
}

// ── Helpers de orden de claves ───────────────────────────────

/**
 * Devuelve las claves de materias respetando _order.
 * @param {object} data
 * @returns {string[]}
 */
function pbMatKeys(data) {
  if (!data || typeof data !== 'object') return [];
  var ord  = (data._order || []).filter(function(k) { return k && data[k] && typeof data[k] === 'object'; });
  var rest = Object.keys(data).filter(function(k) { return !k.startsWith('_') && !ord.includes(k) && data[k] && data[k].paralelos; });
  return Array.from(new Set(ord.concat(rest)));
}

/**
 * Devuelve las claves de paralelos respetando _pOrder.
 * @param {object} mat
 * @returns {string[]}
 */
function pbParKeys(mat) {
  if (!mat || !mat.paralelos) return [];
  var ord  = (mat._pOrder || []).filter(function(p) { return mat.paralelos[p]; });
  var rest = Object.keys(mat.paralelos).filter(function(p) { return !ord.includes(p); });
  return ord.concat(rest);
}
