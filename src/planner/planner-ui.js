/* ============================================================
   Polibaldeo – planner/planner-ui.js
   Gestión del estado y renderizado del panel izquierdo del
   Planner con acordeones. Coordina conflictos y grilla.
   
   Depende de: planner-conflicts.js, planner-grid.js
   Requiere (cargados antes): utils.js, storage.js,
                              components/modal.js
   ============================================================ */

"use strict";

// ── Estado del Planner ───────────────────────────────────────
var PlannerState = {
  data         : {},
  selected     : {},
  colorMap     : {},
  colorCtr     : 0,
  showCalendar : true,
  viewMode     : 'clases',
  // Control de colapso: por defecto todos colapsados
  allCollapsed : true,
  // Mapa individual de colapso (sincronizado con allCollapsed)
  collapsedMap : {},
  // Última materia cuyo acordeón se expandió automáticamente al seleccionar
  lastExpanded : null,
  isInternalChange: false   // nueva propiedad
};

// ── Utilidades de persistencia ────────────────────────────────

/**
 * Guarda la selección actual del planner en chrome.storage.local
 * bajo la clave _selected.
 */
function persistSelection() {
  // Limpiar selecciones huérfanas
  Object.keys(PlannerState.selected).forEach(function(m) {
    if (!PlannerState.data[m] || !PlannerState.data[m].paralelos[PlannerState.selected[m]]) {
      delete PlannerState.selected[m];
    }
  });

  PlannerState.isInternalChange = true;
  pbLoadData(function(data) {
    data._selected = JSON.parse(JSON.stringify(PlannerState.selected));
    pbSaveData(data, function() {
      PlannerState.isInternalChange = false;
    });
  });
}

function persistColorMap() {
  PlannerState.isInternalChange = true;
  pbLoadData(function(data) {
    data._colorMap = JSON.parse(JSON.stringify(PlannerState.data._colorMap));
    pbSaveData(data, function() {
      PlannerState.isInternalChange = false;
    });
  });
}

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

function saveCollapsedState() {
  var state = {};
  getAccordions().forEach(function(acc) {
    var materia = acc.getAttribute('data-materia');
    if (materia) state[materia] = acc.classList.contains('collapsed');
  });
  return state;
}

function restoreCollapsedState(savedState) {
  Object.keys(savedState).forEach(function(m) {
    var acc = getAccordionByMateria(m);
    if (acc) acc.classList.toggle('collapsed', savedState[m]);
    PlannerState.collapsedMap[m] = savedState[m];
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

  if (!PlannerState.data._colorMap) PlannerState.data._colorMap = {};

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
      // Intentar restaurar desde _colorMap
      if (PlannerState.data._colorMap && PlannerState.data._colorMap[m] !== undefined) {
        PlannerState.colorMap[m] = PlannerState.data._colorMap[m];
      } else {
        PlannerState.colorMap[m] = (PlannerState.colorCtr++) % PB_PALETTE.length;
        PlannerState.data._colorMap[m] = PlannerState.colorMap[m];
        persistColorMap();
      }
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

      var cls  = 'par-item';
      if (isSel)      cls += ' par-sel';
      if (isConflictUI) cls += ' par-conflict';
      // Eliminamos "par-off" completamente

      var cbCls = 'par-cb' + (isSel ? ' cb-on' : '');

      var prof = (pd.profesor || '').trim();
      if (!prof) {
        // fallback por si viene de datos antiguos con info
        var profMatch = (pd.info || '').match(/Profesor:\s*(.+)/);
        prof = profMatch ? profMatch[1].trim() : '';
      }
      var ubic = pd.ubicacion || '';
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
          (ubic ? '<div class="par-ubic">' + ubic + '</div>' : '') +
          '<div class="par-slots">' + (slotsHtml || '<span class="slot-pill">Sin horario</span>') + '</div>' +
        '</div>' +
        (hasConflict ? '<span class="sym conflict-icon">warning</span>' : '');

      // Si hay conflicto, añadir tooltip con las materias conflictivas
      if (hasConflict) {
        var conflictIcon = item.querySelector('.conflict-icon');
        if (conflictIcon) {
          var conflictingMats = getConflictingMaterialsForParallel(m, pId);
          var tooltipText = 'Conflicto con: ' + conflictingMats.map(function(c) {
            return c.name + ' (' + c.type + ')';
          }).join(', ');
          conflictIcon.title = tooltipText;
        }
      }

      // Siempre agregamos el listener, sin bloquear conflictos
      item.addEventListener('click', function(ev) {
        ev.stopPropagation();
        var accordion = this.closest('.accordion');
        var materia   = accordion.getAttribute('data-materia');
        var pId       = this.getAttribute('data-paralelo');
        var isCurrentlySelected = (PlannerState.selected[materia] === pId);

        // Simplemente alternar la selección
        if (isCurrentlySelected) {
          delete PlannerState.selected[materia];
        } else {
          PlannerState.selected[materia] = pId;
        }

        persistSelection();

        // Actualizar UI de forma incremental
        updateLeftPanelState();

        // Redibujar bloques y footer
        plannerDrawBlocks();
        plannerUpdateFooter();
      });

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

      // Actualizar clases del ítem
      item.classList.toggle('par-sel', isSel);
      item.classList.toggle('par-conflict', isConflictUI);

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
        // Actualizar tooltip con las materias conflictivas
        var conflictingMats = getConflictingMaterialsForParallel(materia, pId);
        var tooltipText = 'Conflicto con: ' + conflictingMats.map(function(c) {
          return c.name + ' (' + c.type + ')';
        }).join(', ');
        conflictIcon.title = tooltipText;
      } else if (conflictIcon) {
        conflictIcon.remove();
      }
    });
  });
}

function updateParaleloDetails() {
  var cmap = plannerBuildCMap();
  getAccordions().forEach(function(acc) {
    var materia = acc.getAttribute('data-materia');
    var matData = PlannerState.data[materia];
    if (!matData) return;
    var selPar = PlannerState.selected[materia] || null;
    getParaleloItems(acc).forEach(function(item) {
      var pId = item.getAttribute('data-paralelo');
      var pd = matData.paralelos && matData.paralelos[pId];
      if (!pd) {
        // El paralelo fue eliminado → eliminar el item del DOM (y persistir selección si estaba seleccionado)
        item.remove();
        return;
      }

      // Actualizar profesor
      var profEl = item.querySelector('.par-prof');
      if (profEl) {
        var prof = pd.profesor || '';
        if (!prof) {
          var profMatch = (pd.info || '').match(/Profesor:\s*(.+)/);
          prof = profMatch ? profMatch[1].trim() : '';
        }
        profEl.textContent = prof || 'Sin profesor';
      }

      // Actualizar ubicación
      var ubicEl = item.querySelector('.par-ubic');
      if (ubicEl) {
        ubicEl.textContent = pd.ubicacion || '';
      }

      // Actualizar slots de horarios
      var slotsContainer = item.querySelector('.par-slots');
      if (slotsContainer) {
        var slotsHtml = (pd.horarios || []).map(function(h) {
          return '<span class="slot-pill">' + h + '</span>';
        }).join('');
        slotsContainer.innerHTML = slotsHtml || '<span class="slot-pill">Sin horario</span>';
      }

      // Actualizar conflicto
      var hasConflict = cmap[materia + '|' + pId];
      var isSel = (selPar === pId);
      item.classList.toggle('par-conflict', !isSel && hasConflict);
      var conflictIcon = item.querySelector('.conflict-icon');
      if (hasConflict && !isSel) {
        if (!conflictIcon) {
          conflictIcon = document.createElement('span');
          conflictIcon.className = 'sym conflict-icon';
          conflictIcon.textContent = 'warning';
          item.appendChild(conflictIcon);
        }
        var conflictingMats = getConflictingMaterialsForParallel(materia, pId);
        conflictIcon.title = 'Conflicto con: ' + conflictingMats.map(function(c) {
          return c.name + ' (' + c.type + ')';
        }).join(', ');
      } else if (conflictIcon && !hasConflict) {
        conflictIcon.remove();
      }
    });
    // Actualizar chip de créditos
    var credChip = acc.querySelector('.chip-cred');
    if (credChip && matData) {
      credChip.textContent = (matData.creditos || '0') + '\u202fcr';
    }
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
  var savedCollapsed = saveCollapsedState();
  plannerRenderLeft();
  restoreCollapsedState(savedCollapsed);
  plannerDrawBlocks();
  plannerUpdateFooter();
}

// Versión mantenida por compatibilidad con planner.js
function plannerRefresh() {
  var existingAccordions = getAccordions();
  var currentMks = pbMatKeys(PlannerState.data);
  if (existingAccordions.length !== currentMks.length) {
    plannerFullRefresh();
  } else if (existingAccordions.length > 0) {
    updateLeftPanelState();
    plannerDrawBlocks();
    plannerUpdateFooter();
  } else {
    plannerFullRefresh();
  }
}

// ── Toggle colapsar / expandir acordeones ────────────────────

function plannerToggleCollapseAll() {
  PlannerState.allCollapsed = !PlannerState.allCollapsed;

  pbMatKeys(PlannerState.data).forEach(function(m) {
    PlannerState.collapsedMap[m] = PlannerState.allCollapsed;
  });
  PlannerState.lastExpanded = null;

  getAccordions().forEach(function(acc) {
    var materia = acc.getAttribute('data-materia');
    acc.classList.toggle('collapsed', PlannerState.collapsedMap[materia]);
  });

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