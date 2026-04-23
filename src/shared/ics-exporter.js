/* ============================================================
   Polibaldeo – shared/ics-exporter.js
   Generador de archivos .ics (iCalendar) a partir de los
   paralelos seleccionados en el Planner.
   Requiere: utils.js (pbMatKeys, pbParKeys, pbParseH,
             PB_GRID_SH, PB_DAY_MAP)
   ============================================================ */

"use strict";

// Mapeo índice de día → código BYDAY de iCalendar
var ICS_BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR'];

// Duración del semestre en semanas (repeticiones del evento recurrente)
var ICS_WEEKS = 18;

// ── Helpers ──────────────────────────────────────────────────

function _icsPad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Formatea un Date como cadena "YYYYMMDD" para iCalendar.
 */
function _icsDateStr(d) {
  return d.getFullYear() + _icsPad(d.getMonth() + 1) + _icsPad(d.getDate());
}

/**
 * Devuelve la fecha del próximo día de la semana indicado (0=Lun…4=Vie)
 * contando desde hoy. Si hoy ya es ese día, devuelve la próxima semana.
 * @param {number} di  Índice 0–4
 * @returns {Date}
 */
/**
 * Devuelve la fecha del primer día de la semana 'di' (0=Lun…4=Vie)
 * a partir de una fecha de inicio del semestre.
 * Si semStartDate no se provee, usa la próxima ocurrencia desde hoy.
 * @param {number} di              Índice 0–4
 * @param {Date}   [semStartDate]  Fecha de inicio del semestre
 * @returns {Date}
 */
function _icsFirstOccurrence(di, semStartDate) {
  // di: 0=Lun … 4=Vie  →  JS weekday: 1=Lun … 5=Vie
  var jsTarget = di + 1;
  var base     = semStartDate ? new Date(semStartDate) : new Date();
  var jsBase   = base.getDay();                       // 0=Dom … 6=Sáb
  var diff     = (jsTarget - jsBase + 7) % 7;        // 0 si ya es ese día
  var result   = new Date(base);
  result.setDate(base.getDate() + diff);
  return result;
}

/**
 * Convierte minutos relativos a GRID_SH en "HHMMSS" para iCalendar.
 * @param {number} relMin  Minutos desde el inicio de la grilla
 * @returns {string}
 */
function _icsTimeStr(relMin) {
  var absMin = relMin + PB_GRID_SH * 60;
  var h = Math.floor(absMin / 60);
  var m = absMin % 60;
  return _icsPad(h) + _icsPad(m) + '00';
}

/**
 * Escapa caracteres especiales en texto de propiedades iCalendar.
 */
function _icsEscape(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Pliega líneas largas según RFC 5545 §3.1 (máx. 75 octetos).
 */
function _icsFold(lines) {
  return lines.map(function(line) {
    var out = '';
    while (line.length > 75) {
      out  += line.slice(0, 75) + '\r\n ';
      line  = line.slice(75);
    }
    return out + line;
  }).join('\r\n');
}

// ── Generador principal ──────────────────────────────────────

/**
 * Genera el contenido completo de un archivo .ics.
 * Solo incluye los paralelos presentes en el mapa `selected`.
 *
 * @param {object} data        polibaldeo_data completo
 * @param {object} selected    { materia: paraleloId } del Planner
 * @param {Date}   [semStart]  Fecha de inicio del semestre. Si se omite, usa hoy.
 * @param {number} [weeks]     Número de semanas. Por defecto ICS_WEEKS.
 * @returns {string}           Contenido UTF-8 del archivo .ics
 */
function pbGenerateICS(data, selected, semStart, weeks) {
  var totalWeeks = (typeof weeks === 'number' && weeks > 0) ? weeks : ICS_WEEKS;

  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Polibaldeo//ESPOL//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Horario ESPOL',
    'X-WR-TIMEZONE:America/Guayaquil'
  ];

  var mks = pbMatKeys(data);

  mks.forEach(function(m) {
    var pId = selected && selected[m];
    if (!pId) return;

    var mat = data[m];
    var pd  = mat && mat.paralelos && mat.paralelos[pId];
    if (!pd) return;

    var slots = pbParseH(pd.horarios);
    var desc  = _icsEscape((pd.info || '').replace(/\\n/g, '\n'));

    slots.forEach(function(sl, idx) {
      var firstDate  = _icsFirstOccurrence(sl.di, semStart || null);
      var dateStr    = _icsDateStr(firstDate);
      var startTime  = _icsTimeStr(sl.s);
      var endTime    = _icsTimeStr(sl.e);
      var byday      = ICS_BYDAY[sl.di];
      var uid        = m.replace(/[^A-Za-z0-9]/g, '') + '_' + pId + '_' + sl.di + '_' + idx + '@polibaldeo';

      lines.push('BEGIN:VEVENT');
      lines.push('UID:'      + uid);
      lines.push('SUMMARY:'  + _icsEscape(m + ' \u00b7 Par. ' + pId));
      lines.push('DTSTART:'  + dateStr + 'T' + startTime);
      lines.push('DTEND:'    + dateStr + 'T' + endTime);
      lines.push('RRULE:FREQ=WEEKLY;BYDAY=' + byday + ';COUNT=' + totalWeeks);
      lines.push('DESCRIPTION:' + desc);
      lines.push('END:VEVENT');
    });
  });

  lines.push('END:VCALENDAR');
  return _icsFold(lines);
}

/**
 * Dispara la descarga del archivo .ics en el navegador.
 * @param {object} data        polibaldeo_data completo
 * @param {object} selected    Mapa de selecciones del Planner
 * @param {Date}   [semStart]  Fecha de inicio del semestre
 * @param {number} [weeks]     Número de semanas
 * @returns {boolean}          false si no había paralelos seleccionados
 */
function pbExportICSFile(data, selected, semStart, weeks) {
  // Verificar que haya al menos una selección
  var hasSelection = selected && Object.keys(selected).some(function(m) {
    return !!selected[m];
  });
  if (!hasSelection) return false;

  var content = pbGenerateICS(data, selected, semStart, weeks);
  var blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  var a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'horario_espol_' + new Date().toISOString().slice(0, 10) + '.ics';
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
