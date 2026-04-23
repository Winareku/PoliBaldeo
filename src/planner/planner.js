/* ============================================================
   Polibaldeo – planner.js  (Orquestador)
   Responsabilidad única: inicializar, cargar datos y enlazar
   listeners de botones. Toda la lógica de render vive en
   planner-ui.js; la lógica pura en shared/.
   ============================================================ */

(function() {
  "use strict";

  // ── Inicialización ──────────────────────────────────────────

  function init() {
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

  // ── Arranque ─────────────────────────────────────────────────
  init();

})();