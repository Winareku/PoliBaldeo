/* ============================================================
   Polibaldeo – planner/planner-grid.js
   Renderizado de la grilla de horarios.
   Depende de: PlannerState (desde planner-ui.js),
               planner-conflicts.js
   ============================================================ */

"use strict";

/** Construye la estructura estática de columnas y líneas de la grilla. */
function plannerBuildGrid() {
  var grid = document.getElementById('schedule-grid');
  if (!grid) return;
  grid.innerHTML = '';
  grid.style.height = PB_GRID_PX + 'px';

  // Resaltar día actual
  var todayDi = (new Date().getDay() + 6) % 7;
  document.querySelectorAll('.day-hdr[data-di]').forEach(function(el) {
    el.classList.toggle('today', +el.dataset.di === todayDi);
  });

  // Gutter de horas
  var gutter = document.createElement('div');
  gutter.className = 'time-gutter';
  gutter.style.cssText = 'grid-column:1; grid-row:1; height:' + PB_GRID_PX + 'px; position:relative;';
  for (var h = 0; h <= PB_TOTAL_H; h++) {
    var lbl = document.createElement('div');
    lbl.className  = 't-label';
    lbl.style.top  = (h * PB_HOUR_PX) + 'px';
    lbl.textContent = String(PB_GRID_SH + h).padStart(2, '0') + ':00';
    gutter.appendChild(lbl);
  }
  grid.appendChild(gutter);

  // Columnas de días
  for (var d = 0; d < 5; d++) {
    var col = document.createElement('div');
    col.className = 'day-col' + (d === todayDi ? ' today-col' : '');
    col.id        = 'dc-' + d;
    col.style.cssText = 'grid-column:' + (d + 2) + '; grid-row:1; height:' + PB_GRID_PX + 'px; position:relative;';

    for (var hh = 0; hh <= PB_TOTAL_H; hh++) {
      var hl = document.createElement('div');
      hl.className = 'h-line';
      hl.style.top = (hh * PB_HOUR_PX) + 'px';
      col.appendChild(hl);

      if (hh < PB_TOTAL_H) {
        var halfLine = document.createElement('div');
        halfLine.className = 'hh-line';
        halfLine.style.top = (hh * PB_HOUR_PX + PB_HOUR_PX / 2) + 'px';
        col.appendChild(halfLine);
      }
    }
    grid.appendChild(col);
  }
}

/** Elimina todos los bloques de eventos renderizados. */
function plannerClearBlocks() {
  document.querySelectorAll('.ev-block').forEach(function(b) { b.remove(); });
}

/** Dibuja en la grilla los paralelos seleccionados según el modo actual. */
function plannerDrawBlocks() {
  plannerClearBlocks();
  if (PlannerState.viewMode === 'clases') {
    // Código original de dibujar clases
    pbMatKeys(PlannerState.data).forEach(function(m) {
      var pId = PlannerState.selected[m];
      if (!pId) return;
      var pd = PlannerState.data[m].paralelos[pId];
      if (!pd) return;
      var c = PB_PALETTE[PlannerState.colorMap[m] !== undefined ? PlannerState.colorMap[m] : 0];

      // Dibujar horarios teóricos
      pbParseH(pd.horariosTeoricos || pd.horarios || []).forEach(function(sl) {
        var col = document.getElementById('dc-' + sl.di);
        if (!col) return;
        var blk = document.createElement('div');
        blk.className  = 'ev-block';
        blk.style.cssText =
          'top:'    + (sl.s * PB_MIN_PX) + 'px;' +
          'height:' + Math.max((sl.e - sl.s) * PB_MIN_PX, 20) + 'px;' +
          'background:' + c.bg + ';' +
          'color:'      + c.fg + ';' +
          'border:1px solid ' + c.ac + '33;' +
          'border-left:3px solid ' + c.ac + ';';
        blk.innerHTML  = '<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + m + '</div><div style="opacity:.55;font-size:8.5px">P' + pId + '</div>';
        var ubicText = pd.ubicacionTeorico || pd.ubicacion || '';
        blk.title      = m + ' · Par. ' + pId + '\n' + pbStripSec(sl.raw) + (ubicText ? '\n' + ubicText : '');
        col.appendChild(blk);
      });

      // Dibujar horarios prácticos (si existen)
      if (pd.horariosPracticos && pd.horariosPracticos.length) {
        pbParseH(pd.horariosPracticos).forEach(function(sl) {
          var col = document.getElementById('dc-' + sl.di);
          if (!col) return;
          var blk = document.createElement('div');
          blk.className = 'ev-block exam-block';
          blk.style.cssText =
            'top:' + (sl.s * PB_MIN_PX) + 'px;' +
            'height:' + Math.max((sl.e - sl.s) * PB_MIN_PX, 20) + 'px;' +
            'background:' + c.bg + ';' +
            'color:' + c.fg + ';' +
            'border:1px dashed ' + c.ac + '66;' +
            'border-left:3px solid ' + c.ac + ';';
          blk.innerHTML = '<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + m + ' (Prác.)</div><div style="opacity:.55;font-size:8.5px">P' + pId + '</div>';
          var ubicText = pd.ubicacionPractico || '';
          blk.title = m + ' · Práctico · Par. ' + pId + '\n' + pbStripSec(sl.raw) + (ubicText ? '\n' + ubicText : '');
          col.appendChild(blk);
        });
      }
    });
  } else {
    plannerDrawExamBlocks();
  }
}

/** Dibuja en la grilla los exámenes de los paralelos seleccionados según el modo actual. */
function plannerDrawExamBlocks() {
  var examKey = {
    'examenes-parcial': 'parcial',
    'examenes-final': 'final',
    'examenes-mejoramiento': 'mejoramiento'
  }[PlannerState.viewMode] || 'parcial';

  pbMatKeys(PlannerState.data).forEach(function(m) {
    var pId = PlannerState.selected[m];
    if (!pId) return;
    var pd = PlannerState.data[m].paralelos[pId];
    if (!pd) return;
    var exam = pd.examenes && pd.examenes[examKey];
    if (!exam || !exam.fecha || !exam.inicio || !exam.fin) return;

    // Calcular día de la semana (0 = Lunes … 4 = Viernes)
    var fecha = new Date(exam.fecha + 'T00:00:00');
    var jsDay = fecha.getDay(); // 0 = Domingo
    var di = (jsDay + 6) % 7;   // Ajuste para que 0 = Lunes
    if (di > 4) return;         // Solo mostramos exámenes entre lunes y viernes

    var c = PB_PALETTE[PlannerState.colorMap[m] !== undefined ? PlannerState.colorMap[m] : 0];
    var s = pbTimeToMin(exam.inicio);
    var e = pbTimeToMin(exam.fin);

    var col = document.getElementById('dc-' + di);
    if (!col) return;

    var blk = document.createElement('div');
    blk.className = 'ev-block exam-block'; // clase extra para estilo opcional
    blk.style.cssText =
      'top:'    + (s * PB_MIN_PX) + 'px;' +
      'height:' + Math.max((e - s) * PB_MIN_PX, 20) + 'px;' +
      'background:' + c.bg + ';' +
      'color:'      + c.fg + ';' +
      'border:1px dashed ' + c.ac + '66;' +
      'border-left:3px solid ' + c.ac + ';';
    blk.innerHTML  = '<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + m + ' (Examen)</div><div style="opacity:.55;font-size:8.5px">P' + pId + '</div>';
    blk.title      = m + ' · Examen · Par. ' + pId + '\n' + exam.fecha + ' ' + exam.inicio + '-' + exam.fin + (exam.aula ? '\n' + exam.aula : '');
    col.appendChild(blk);
  });
}
