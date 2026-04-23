/* ============================================================
   Polibaldeo – planner/planner-ui.js
   Renderizado incremental del Planner:
     · Grilla de horario (buildGrid / drawBlocks)
     · Panel izquierdo con acordeones (construcción inicial +
       actualización selectiva de conflictos / selección)
     · Footer (updateFooter)
   Requiere (cargados antes): utils.js, storage.js, exporter.js
   ============================================================ */

"use strict";

// ── Estado del Planner ───────────────────────────────────────
var PlannerState = {
  data         : {},
  selected     : {},
  colorMap     : {},
  colorCtr     : 0,
  showCalendar : true,
  // Control de colapso: por defecto todos colapsados
  allCollapsed : true,
  // Mapa individual de colapso (sincronizado con allCollapsed)
  collapsedMap : {},
  // Última materia cuyo acordeón se expandió automáticamente al seleccionar
  lastExpanded : null
};

// Ancho mínimo (px) para mostrar el calendario automáticamente
var CALENDAR_BREAKPOINT = 700;

// ── Utilidades DOM ───────────────────────────────────────────

/** Obtiene todos los acordeones actualmente en el DOM */
function getAccordions() {
  return document.querySelectorAll('.accordion');
}

/** Obtiene el elemento acordeón de una materia específica */
function getAccordionByMateria(materia) {
  return document.querySelector(`.accordion[data-materia="${materia}"]`);
}

/** Obtiene todos los ítems de paralelo dentro de un acordeón */
function getParaleloItems(accordion) {
  return accordion.querySelectorAll('.par-item');
}

// ── Mapa de conflictos (puro, sin DOM) ───────────────────────

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
      cmap[m + '|' + p] = conflict;
    });
  });

  return cmap;
}

// ── Grilla de horario ────────────────────────────────────────

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

/** Dibuja en la grilla los paralelos actualmente seleccionados. */
function plannerDrawBlocks() {
  plannerClearBlocks();
  pbMatKeys(PlannerState.data).forEach(function(m) {
    var pId = PlannerState.selected[m];
    if (!pId) return;
    var pd = PlannerState.data[m].paralelos[pId];
    if (!pd) return;
    var c = PB_PALETTE[PlannerState.colorMap[m] !== undefined ? PlannerState.colorMap[m] : 0];

    pbParseH(pd.horarios).forEach(function(sl) {
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
      blk.title      = m + ' · Par. ' + pId + '\n' + sl.raw;
      col.appendChild(blk);
    });
  });
}

// ── Panel izquierdo: construcción inicial ─────────────────────

/**
 * Construye por primera vez todos los acordeones.
 * Se llama únicamente al cargar los datos iniciales o cuando
 * se produce un cambio estructural en los datos (nueva materia,
 * eliminación, etc.). Para cambios de selección se usa
 * updateLeftPanelState().
 */
function plannerRenderLeft() {
  var scroll  = document.getElementById('left-scroll');
  var emptyEl = document.getElementById('empty-state');
  var mks     = pbMatKeys(PlannerState.data);

  // Limpiar acordeones anteriores
  scroll.querySelectorAll('.accordion').forEach(function(el) { el.remove(); });

  if (mks.length === 0) {
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  // Inicializar mapa de colapso según allCollapsed
  mks.forEach(function(m) {
    PlannerState.collapsedMap[m] = PlannerState.allCollapsed;
  });

  var cmap = plannerBuildCMap();

  mks.forEach(function(m) {
    var mat = PlannerState.data[m];
    if (PlannerState.colorMap[m] === undefined) {
      PlannerState.colorMap[m] = (PlannerState.colorCtr++) % PB_PALETTE.length;
    }
    var c      = PB_PALETTE[PlannerState.colorMap[m]];
    var selPar = PlannerState.selected[m] !== undefined ? PlannerState.selected[m] : null;

    // ── Acordeón ──────────────────────────────────────────
    var acc = document.createElement('div');
    acc.className = 'accordion' + (selPar ? ' has-sel' : '');
    acc.setAttribute('data-materia', m);
    acc.style.setProperty('--mat-ac', c.ac);

    // Aplicar estado de colapso inicial
    if (PlannerState.collapsedMap[m]) {
      acc.classList.add('collapsed');
    }

    // Cabecera
    var hdr = document.createElement('div');
    hdr.className = 'acc-hdr';
    hdr.innerHTML =
      '<div class="color-dot" style="background:' + c.dot + '"></div>' +
      '<span class="acc-name" title="' + m + '">' + m + '</span>' +
      '<div class="acc-meta">' +
        '<span class="chip chip-cred">' + (mat.creditos || 0) + '&thinsp;cr</span>' +
        '<span class="sym acc-chevron">expand_more</span>' +
      '</div>';
    hdr.onclick = function(e) {
      e.stopPropagation();
      var materia = this.closest('.accordion').getAttribute('data-materia');
      // Alternar colapso individual
      PlannerState.collapsedMap[materia] = !PlannerState.collapsedMap[materia];
      var accEl = getAccordionByMateria(materia);
      if (accEl) accEl.classList.toggle('collapsed', PlannerState.collapsedMap[materia]);
      // No se actualiza allCollapsed (no es un toggle global)
    };
    acc.appendChild(hdr);

    // Cuerpo
    var body = document.createElement('div');
    body.className = 'acc-body';

    var pKeys = pbParKeys(mat);
    if (pKeys.length === 0) {
      var emptyMsg = document.createElement('div');
      emptyMsg.textContent = 'Sin paralelos';
      emptyMsg.style.cssText = 'padding:4px 10px; color:var(--on-surf-var); font-size:11px; font-style:italic; text-align:center; opacity:0.7;';
      body.appendChild(emptyMsg);
    } else {
      pKeys.forEach(function(pId) {
      var pd = mat.paralelos && mat.paralelos[pId];
      if (!pd) return;

      var isSel      = (selPar === pId);
      var hasConflict = cmap[m + '|' + pId];
      var isConflictUI = !isSel && hasConflict;
      var isDisabled = !isSel && selPar !== null && !hasConflict;

      var cls  = 'par-item';
      if (isSel)      cls += ' par-sel';
      if (isConflictUI) cls += ' par-conflict';
      else if (isDisabled) cls += ' par-off';

      var cbCls = 'par-cb' + (isSel ? ' cb-on' : '');

      var profMatch  = (pd.info || '').match(/Profesor:\s*(.+)/);
      var prof       = profMatch ? profMatch[1].trim() : '';
      var slotsHtml  = (pd.horarios || []).map(function(h) {
        return '<span class="slot-pill">' + h + '</span>';
      }).join('');

      var item = document.createElement('div');
      item.className = cls;
      item.setAttribute('data-paralelo', pId);
      item.innerHTML =
        '<div class="' + cbCls + '"><span class="sym">check</span></div>' +
        '<div class="par-content">' +
          '<span class="par-badge" style="background:' + c.ac + '1a; color:' + c.fg + '; border:1px solid ' + c.ac + '40">Par. ' + pId + '</span>' +
          (prof ? '<div class="par-prof">' + prof + '</div>' : '') +
          '<div class="par-slots">' + (slotsHtml || '<span class="slot-pill">Sin horario</span>') + '</div>' +
        '</div>' +
        (hasConflict ? '<span class="sym conflict-icon">warning</span>' : '');

      if (!isConflictUI && !isDisabled) {
        item.addEventListener('click', function(ev) {
          ev.stopPropagation();
          var accordion = this.closest('.accordion');
          var materia   = accordion.getAttribute('data-materia');
          var pId       = this.getAttribute('data-paralelo');
          var isCurrentlySelected = (PlannerState.selected[materia] === pId);

          // 1. Actualizar selección
          if (isCurrentlySelected) {
            delete PlannerState.selected[materia];
          } else {
            PlannerState.selected[materia] = pId;
          }

          // 2. Actualizar UI de forma incremental (sin tocar el estado de colapso)
          updateLeftPanelState();

          // 3. Redibujar bloques y footer
          plannerDrawBlocks();
          plannerUpdateFooter();
        });
      }

      body.appendChild(item);
    });
    }

    acc.appendChild(body);
    scroll.appendChild(acc);
  });
}

// ── Actualización incremental del panel izquierdo ─────────────

/**
 * Actualiza las clases de todos los ítems de paralelo según el
 * nuevo estado de selección y conflictos. Además, aplica el
 * estado de colapso almacenado en collapsedMap a cada acordeón.
 * Esta función no reconstruye el DOM, solo modifica clases.
 */
function updateLeftPanelState() {
  var cmap = plannerBuildCMap();

  getAccordions().forEach(function(acc) {
    var materia = acc.getAttribute('data-materia');
    var selPar  = PlannerState.selected[materia];

    // Actualizar clase has-sel del acordeón
    acc.classList.toggle('has-sel', !!selPar);

    // Aplicar colapso según collapsedMap
    acc.classList.toggle('collapsed', PlannerState.collapsedMap[materia]);

    // Recorrer cada ítem de paralelo dentro de este acordeón
    getParaleloItems(acc).forEach(function(item) {
      var pId = item.getAttribute('data-paralelo');
      var isSel      = (selPar === pId);
      var hasConflict = cmap[materia + '|' + pId];
      var isConflictUI = !isSel && hasConflict;
      var isDisabled = !isSel && !!selPar && !hasConflict;

      // Actualizar clases del ítem
      item.classList.toggle('par-sel', isSel);
      item.classList.toggle('par-conflict', isConflictUI);
      item.classList.toggle('par-off', isDisabled);

      // Actualizar checkbox visual
      var cb = item.querySelector('.par-cb');
      if (cb) {
        cb.classList.toggle('cb-on', isSel);
      }

      // Actualizar icono de conflicto (puede existir o no)
      var conflictIcon = item.querySelector('.conflict-icon');
      if (hasConflict) {
        if (!conflictIcon) {
          conflictIcon = document.createElement('span');
          conflictIcon.className = 'sym conflict-icon';
          conflictIcon.textContent = 'warning';
          item.appendChild(conflictIcon);
        }
      } else if (conflictIcon) {
        conflictIcon.remove();
      }
    });
  });
}

// ── Footer ───────────────────────────────────────────────────

/** Actualiza el contador de créditos y el badge de conflictos. */
function plannerUpdateFooter() {
  var total = 0;
  pbMatKeys(PlannerState.data).forEach(function(m) {
    if (PlannerState.selected[m]) {
      total += parseInt(PlannerState.data[m].creditos || '0', 10) || 0;
    }
  });
  document.getElementById('cred-num').textContent = total;

  var cmap       = plannerBuildCMap();
  var anyConflict = Object.keys(cmap).some(function(k) {
    var parts = k.split('|');
    var m     = parts[0];
    var p     = parts[1];
    return cmap[k] && PlannerState.selected[m] === p;
  });
  document.getElementById('conflict-badge').classList.toggle('show', anyConflict);
}

// ── Ciclo de refresco completo (solo para cambios estructurales) ─

/**
 * Refresco completo: reconstruye el panel izquierdo desde cero.
 * Útil cuando cambian los datos (nueva materia, eliminación, etc.).
 * Para cambios de selección usar updateLeftPanelState().
 */
function plannerFullRefresh() {
  plannerRenderLeft();
  plannerDrawBlocks();
  plannerUpdateFooter();
}

// Versión mantenida por compatibilidad con planner.js
function plannerRefresh() {
  // Si ya hay acordeones en el DOM y los datos no han cambiado
  // en estructura, podríamos usar la actualización incremental.
  // Pero como planner.js llama a plannerRefresh() sin contexto,
  // optamos por hacer la incremental si el DOM ya está poblado.
  var existingAccordions = getAccordions();
  if (existingAccordions.length > 0) {
    // Actualización incremental
    updateLeftPanelState();
    plannerDrawBlocks();
    plannerUpdateFooter();
  } else {
    // Primera carga
    plannerFullRefresh();
  }
}

// ── Toggle colapsar / expandir acordeones ────────────────────

/**
 * Alterna entre colapsar todos los acordeones y expandirlos.
 * Actualiza el ícono del botón para reflejar la acción disponible.
 */
function plannerToggleCollapseAll() {
  PlannerState.allCollapsed = !PlannerState.allCollapsed;

  // Actualizar mapa individual
  pbMatKeys(PlannerState.data).forEach(function(m) {
    PlannerState.collapsedMap[m] = PlannerState.allCollapsed;
  });
  // Si había una expansión forzada por selección, la limpiamos
  PlannerState.lastExpanded = null;

  // Aplicar clases directamente en el DOM
  getAccordions().forEach(function(acc) {
    var materia = acc.getAttribute('data-materia');
    acc.classList.toggle('collapsed', PlannerState.collapsedMap[materia]);
  });

  // Actualizar botón
  var btn = document.getElementById('btn-collapse-all');
  if (btn) {
    btn.title = PlannerState.allCollapsed ? 'Expandir todo' : 'Colapsar todo';
    btn.querySelector('.sym').textContent = PlannerState.allCollapsed
      ? 'unfold_more'
      : 'unfold_less';
  }
}

// ── Toggle visibilidad del calendario ────────────────────────

function plannerApplyCalendarVisibility() {
  var rightPanel  = document.querySelector('.right-panel');
  var leftPanel   = document.querySelector('.left-panel');
  var btn         = document.getElementById('btn-toggle-calendar');
  if (!rightPanel) return;

  var windowWidth = document.documentElement.clientWidth || window.innerWidth;
  var tooNarrow   = windowWidth < CALENDAR_BREAKPOINT;

  var visible = PlannerState.showCalendar && !tooNarrow;
  rightPanel.style.display = visible ? '' : 'none';

  if (leftPanel) {
    if (visible) {
      leftPanel.style.width = '340px';
      leftPanel.style.flex = '0 0 auto';
    } else {
      leftPanel.style.width = '100%';
      leftPanel.style.flex = '1 1 auto';
    }
  }

  if (btn) {
    btn.querySelector('.sym').textContent = PlannerState.showCalendar
      ? 'calendar_view_week'
      : 'calendar_view_month';
    btn.title = PlannerState.showCalendar
      ? 'Ocultar calendario'
      : 'Mostrar calendario';
  }
}

function plannerToggleCalendar() {
  PlannerState.showCalendar = !PlannerState.showCalendar;
  plannerApplyCalendarVisibility();
}

// ── ResizeObserver: auto-ocultar al encoger la ventana ───────

function plannerInitResizeObserver() {
  var appEl = document.querySelector('.app');
  if (!appEl || typeof ResizeObserver === 'undefined') return;

  var ro = new ResizeObserver(function() {
    plannerApplyCalendarVisibility();
  });
  ro.observe(appEl);
}