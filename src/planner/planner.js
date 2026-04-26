/* ============================================================
   Polibaldeo – planner.js  (Orquestador)
   Responsabilidad única: inicializar, cargar datos y enlazar
   listeners de botones.
   
   Depende de: planner-ui.js, planner-grid.js, planner-conflicts.js
   Requiere (cargados antes): utils.js, storage.js, ics-exporter.js,
                              components/modal.js, libs/html-to-image.min.js
   ============================================================ */

(function() {
  "use strict";

  // ── Inicialización ──────────────────────────────────────────

  function init() {
    PlannerState.viewMode = 'clases';
    pbLoadData(function(data) {
      PlannerState.data = data;
      plannerBuildGrid();
      plannerRefresh();
      plannerInitResizeObserver();
      plannerApplyCalendarVisibility();
    });
  }

  // ── Botones de header ───────────────────────────────────────

  document.getElementById('btn-deselect-all').onclick = function() {
    PlannerState.selected = {};
    plannerRefresh();
  };

  document.getElementById('btn-collapse-all').onclick = plannerToggleCollapseAll;

  // ── Modal de exportación ICS (con PBModal) ───────────────────

  var _icsWeeks = 18;

  function _plannerWarnBadge(msg) {
    var badge = document.getElementById('conflict-badge');
    if (!badge) return;
    var prevHTML = badge.innerHTML;
    badge.innerHTML = '<span class="sym">warning</span> ' + msg;
    badge.classList.add('show');
    setTimeout(function() {
      badge.innerHTML = prevHTML;
      if (typeof plannerUpdateFooter === 'function') {
        plannerUpdateFooter();
      } else {
        badge.classList.remove('show');
      }
    }, 2500);
  }

  function _icsOpenModal() {
    var hasSelection = PlannerState.selected &&
      Object.keys(PlannerState.selected).some(function(m) {
        return !!PlannerState.selected[m];
      });
    if (!hasSelection) {
      _plannerWarnBadge('Selecciona al menos un paralelo');
      return;
    }

    var bodyHTML = `
      <div class="ics-field">
        <label class="ics-label" for="ics-start-date">Fecha de inicio del semestre</label>
        <input type="date" class="ics-input" id="ics-start-date" />
      </div>
      <div class="ics-field">
        <span class="ics-label">Duración del semestre</span>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="creditos-stepper" style="flex: 0 0 auto;">
            <button id="ics-weeks-minus" type="button">−</button>
            <span id="ics-weeks-val" class="creditos-value" style="min-width: 32px;">${_icsWeeks}</span>
            <button id="ics-weeks-plus" type="button">+</button>
          </div>
          <span style="font-size: 13px; color: var(--text-sub);">semanas</span>
        </div>
      </div>
    `;

    var modal = PBModal.create({
      title: 'Exportar a Calendario',
      body: bodyHTML,
      footer: `
        <button class="btn btn-outline" id="ics-cancel">Cancelar</button>
        <button class="btn btn-primary" id="ics-confirm">
          <span class="sym" style="font-size:16px;vertical-align:middle;margin-right:4px">download</span>Descargar .ics
        </button>
      `
    });

    modal.open();

    var weeksSpan = modal.getElement('#ics-weeks-val');
    var dateInput = modal.getElement('#ics-start-date');

    modal.getElement('#ics-weeks-minus').onclick = function() {
      if (_icsWeeks > 1) {
        _icsWeeks--;
        weeksSpan.textContent = _icsWeeks;
      }
    };
    modal.getElement('#ics-weeks-plus').onclick = function() {
      if (_icsWeeks < 52) {
        _icsWeeks++;
        weeksSpan.textContent = _icsWeeks;
      }
    };

    modal.getElement('#ics-cancel').onclick = function() {
      modal.destroy();
    };

    modal.getElement('#ics-confirm').onclick = function() {
      var dateVal = dateInput.value;
      var semStart = dateVal ? new Date(dateVal + 'T00:00:00') : null;

      var ok = pbExportICSFile(PlannerState.data, PlannerState.selected, semStart, _icsWeeks);
      if (ok) {
        modal.destroy();
      } else {
        _plannerWarnBadge('Selecciona al menos un paralelo');
        modal.destroy();
      }
    };

    dateInput.focus();
  }

  document.getElementById('btn-export-ics').onclick = _icsOpenModal;

  // Mostrar / Ocultar calendario
  document.getElementById('btn-toggle-calendar').onclick = plannerToggleCalendar;

  // ── Captura de imagen del horario ─────────────────────────────

  function _captureScheduleImage() {
    var rightPanel   = document.querySelector('.right-panel');
    var gridScroll   = document.querySelector('.grid-scroll');
    var scheduleGrid = document.getElementById('schedule-grid');

    // No hacer nada si el calendario está oculto
    if (!rightPanel || !gridScroll || !scheduleGrid) return;
    if (rightPanel.style.display === 'none') {
      _plannerWarnBadge('El calendario está oculto');
      return;
    }

    // Guardar estilos originales
    var origRightWidth     = rightPanel.style.width;
    var origRightHeight    = rightPanel.style.height;
    var origRightFlex      = rightPanel.style.flex;
    var origOverflow       = gridScroll.style.overflow;
    var origMaxHeight      = gridScroll.style.maxHeight;
    var origHeight         = gridScroll.style.height;
    var origGridHeight     = scheduleGrid.style.height;

    // Forzar dimensiones fijas para que se muestre todo el contenido
    rightPanel.style.width      = '1200px';
    rightPanel.style.height     = 'auto';
    rightPanel.style.flex       = 'none';
    gridScroll.style.overflow   = 'visible';
    gridScroll.style.maxHeight  = 'none';
    gridScroll.style.height     = 'auto';
    scheduleGrid.style.height   = PB_GRID_PX + 'px';

    // Pequeño retraso para que el navegador reaccione al cambio de layout
    setTimeout(function() {
      // Capturar el panel derecho completo
      htmlToImage.toPng(rightPanel, {
        width: 1200,
        height: rightPanel.scrollHeight,
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#121212'
      }).then(function (dataUrl) {
        // Descargar imagen
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'horario_espol_' + new Date().toISOString().slice(0, 10) + '.png';
        a.click();

        // Restaurar estilos originales
        restoreStyles();
      }).catch(function (error) {
        console.error('Error al capturar la imagen:', error);
        restoreStyles();
      });
    }, 100);

    function restoreStyles() {
      rightPanel.style.width      = origRightWidth;
      rightPanel.style.height     = origRightHeight;
      rightPanel.style.flex       = origRightFlex;
      gridScroll.style.overflow   = origOverflow;
      gridScroll.style.maxHeight  = origMaxHeight;
      gridScroll.style.height     = origHeight;
      scheduleGrid.style.height   = origGridHeight;
    }
  }

  document.getElementById('btn-capture-image').onclick = _captureScheduleImage;

  // ── Auto-selección de combinación sin conflictos ─────────────

  // ── Función auxiliar para detectar conflictos de clase ───────
  function _hasClassConflict(materia, pId) {
    var data = PlannerState.data;
    var slots = pbParseH(data[materia].paralelos[pId].horarios);
    var mks = pbMatKeys(data);
    for (var i = 0; i < mks.length; i++) {
      var sm = mks[i];
      if (sm === materia) continue;
      var selPId = PlannerState.selected[sm];
      if (!selPId) continue;
      var selSlots = pbParseH(data[sm].paralelos[selPId].horarios);
      if (pbOverlaps(slots, selSlots)) return true;
    }
    return false;
  }

  // ── Función shuffle (Fisher‑Yates) ──────────────────────────
  function _shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // ── Auto‑selección con backtracking aleatorio ───────────────
  function _autoSelectOptimal() {
    var mks = pbMatKeys(PlannerState.data);
    PlannerState.selected = {};

    var total = mks.length;
    var success = false;

    function backtrack(index) {
      if (index >= mks.length) {
        success = true;
        return true;
      }
      var m = mks[index];
      var pKeys = pbParKeys(PlannerState.data[m]);
      if (pKeys.length === 0) return false;

      // Mezcla aleatoria de los paralelos disponibles
      _shuffle(pKeys);

      for (var i = 0; i < pKeys.length; i++) {
        var pId = pKeys[i];
        PlannerState.selected[m] = pId;
        if (!hasExamConflict(m, pId) && !_hasClassConflict(m, pId)) {
          if (backtrack(index + 1)) return true;
        }
        delete PlannerState.selected[m];
      }
      return false;
    }

    backtrack(0);

    // Si no se encontró combinación completa, usar fallback voraz
    if (!success) {
      PlannerState.selected = {};
      for (var i = 0; i < mks.length; i++) {
        var m = mks[i];
        var pKeys = pbParKeys(PlannerState.data[m]);
        var found = false;
        for (var j = 0; j < pKeys.length; j++) {
          var pId = pKeys[j];
          PlannerState.selected[m] = pId;
          if (!hasExamConflict(m, pId) && !_hasClassConflict(m, pId)) {
            found = true;
            break;
          }
          delete PlannerState.selected[m];
        }
      }
    }

    plannerRefresh();

    // Mensaje en badge
    var badge = document.getElementById('conflict-badge');
    if (badge) {
      var placed = Object.keys(PlannerState.selected).length;
      if (placed === total) {
        badge.innerHTML = '<span class="sym">check_circle</span> ¡Combinación completa encontrada!';
        badge.classList.add('show');
        setTimeout(function() { badge.classList.remove('show'); plannerUpdateFooter(); }, 3000);
      } else {
        badge.innerHTML = '<span class="sym">info</span> ' + placed + ' materias colocadas, ' + (total - placed) + ' sin opción disponible.';
        badge.classList.add('show');
        setTimeout(function() { badge.classList.remove('show'); plannerUpdateFooter(); }, 4000);
      }
    }
  }

  document.getElementById('btn-auto-select')?.addEventListener('click', _autoSelectOptimal);

  // ── Alternar vista Clases / Exámenes ─────────────────────────

  document.getElementById('btn-toggle-exams').onclick = function() {
    PlannerState.viewMode = (PlannerState.viewMode === 'clases') ? 'examenes' : 'clases';
    var btn = document.getElementById('btn-toggle-exams');
    if (btn) {
      if (PlannerState.viewMode === 'examenes') {
        btn.querySelector('.sym').textContent = 'calendar_month';
        btn.title = 'Ver horario de clases';
      } else {
        btn.querySelector('.sym').textContent = 'edit_calendar';
        btn.title = 'Ver exámenes';
      }
    }
    plannerRefresh();
  };

  // ── Arranque ─────────────────────────────────────────────────
  init();

})();