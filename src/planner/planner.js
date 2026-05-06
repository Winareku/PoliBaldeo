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

  // ── Sistema de toasts (compartido con popup) ─────────────────
  var _plannerToastQueue = [];

  function _removePlannerToast(entry, immediate) {
    if (!entry || !entry.el) return;
    clearTimeout(entry.timer);
    var idx = _plannerToastQueue.indexOf(entry);
    if (idx > -1) _plannerToastQueue.splice(idx, 1);
    if (immediate) {
      entry.el.remove();
    } else {
      entry.el.classList.add('removing');
      setTimeout(function() {
        if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
      }, 250);
    }
  }

  /**
   * Muestra un toast simple en el planner.
   * @param {string} msg
   * @param {string} type - 'success', 'warning', 'info'
   */
  function plannerSetStatus(msg, type) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'pb-toast ' + (type || 'info');
    var msgSpan = document.createElement('span');
    msgSpan.className = 'toast-msg';
    msgSpan.textContent = msg;
    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);
    container.appendChild(toast);
    var entry = { el: toast, timer: null };
    closeBtn.onclick = function() { _removePlannerToast(entry, false); };
    entry.timer = setTimeout(function() { _removePlannerToast(entry, false); }, 4000);
    _plannerToastQueue.push(entry);
  }

  // Diálogo de confirmación genérico (usa PBModal)
  function plannerConfirm(msg, onOk) {
    var modal = PBModal.create({
      title: 'Confirmar',
      body: '<p style="font-size:14px;line-height:1.5;color:var(--text-main);">' + msg + '</p>',
      footer: `
        <button class="btn btn-outline" id="modal-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-ok">Confirmar</button>
      `
    });
    modal.open();
    modal.getElement('#modal-cancel').onclick = function() { modal.destroy(); };
    modal.getElement('#modal-ok').onclick = function() {
      modal.destroy();
      if (typeof onOk === 'function') onOk();
    };
  }

  // ── Inicialización ──────────────────────────────────────────

  function init() {
    PlannerState.viewMode = 'clases';
    pbLoadData(function(data) {
      PlannerState.data = data;
      // Restaurar selección guardada
      if (data._selected && typeof data._selected === 'object') {
        PlannerState.selected = data._selected;
      } else {
        PlannerState.selected = {};
      }
      if (data._colorMap && typeof data._colorMap === 'object') {
        PlannerState.colorMap = Object.assign({}, data._colorMap);
        var maxIdx = -1;
        Object.keys(data._colorMap).forEach(function(k) {
          maxIdx = Math.max(maxIdx, data._colorMap[k]);
        });
        PlannerState.colorCtr = maxIdx + 1;
      }
      plannerBuildGrid();
      // Aplicar ícono inicial del botón de vista
      var btnView = document.getElementById('btn-toggle-exams');
      if (btnView) {
        btnView.querySelector('.sym').textContent = 'school';
        btnView.title = 'Ver exámenes (Parcial)';
      }
      plannerRefresh();
      plannerInitResizeObserver();
      plannerApplyCalendarVisibility();
    });
  }

  // ── Botones de header ───────────────────────────────────────

  document.getElementById('btn-deselect-all').onclick = function() {
    if (Object.keys(PlannerState.selected).length === 0) return;
    plannerConfirm('¿Deseleccionar todos los paralelos?', function() {
      PlannerState.selected = {};
      persistSelection();
      plannerRefresh();
    });
  };

  document.getElementById('btn-collapse-all').onclick = plannerToggleCollapseAll;
  document.getElementById('btn-toggle-calendar').onclick = plannerToggleCalendar;

  // ── Modal de exportación ICS (con PBModal) ───────────────────

  var _icsWeeks = 18;

  function _icsOpenModal() {
    var hasSelection = PlannerState.selected &&
      Object.keys(PlannerState.selected).some(function(m) {
        return !!PlannerState.selected[m];
      });
    if (!hasSelection) {
      plannerSetStatus('Selecciona al menos un paralelo', 'warning');
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
        plannerSetStatus('Selecciona al menos un paralelo', 'warning');
        modal.destroy();
      }
    };

    dateInput.focus();
  }

  document.getElementById('btn-export-ics').onclick = _icsOpenModal;

  document.getElementById('btn-toggle-exams').onclick = function() {
    var modes = ['clases', 'examenes-parcial', 'examenes-final', 'examenes-mejoramiento'];
    var idx = modes.indexOf(PlannerState.viewMode);
    var next = modes[(idx + 1) % modes.length];
    PlannerState.viewMode = next;

    var btn = document.getElementById('btn-toggle-exams');
    if (btn) {
      var icons = {
        'clases': 'school',
        'examenes-parcial': 'looks_one',
        'examenes-final': 'looks_two',
        'examenes-mejoramiento': 'looks_3'
      };
      var titles = {
        'clases': 'Ver exámenes (Parcial)',
        'examenes-parcial': 'Ver exámenes (Final)',
        'examenes-final': 'Ver exámenes (Mejoramiento)',
        'examenes-mejoramiento': 'Ver horario de clases'
      };
      btn.querySelector('.sym').textContent = icons[next];
      btn.title = titles[next];
    }
    plannerRefresh();
  };

  // ── Captura de imagen del horario ─────────────────────────────

  function _captureScheduleImage() {
    var rightPanel   = document.querySelector('.right-panel');
    var daysHdr      = document.querySelector('.days-hdr');
    var gridScroll   = document.querySelector('.grid-scroll');
    var scheduleGrid = document.getElementById('schedule-grid');
    var gutterEl     = document.querySelector('.time-gutter');
    var btn          = document.getElementById('btn-capture-image');

    if (!rightPanel || !daysHdr || !gridScroll || !scheduleGrid) return;
    if (rightPanel.style.display === 'none') {
      plannerSetStatus('El calendario está oculto', 'warning');
      return;
    }

    // Bloquear botón
    if (btn) btn.disabled = true;

    // ── 1. Calcular rango horario ocupado ─────────────────────
    var minMinute = 24 * 60, maxMinute = 0;
    var selectedMats = PlannerState.selected;
    var allKeys = pbMatKeys(PlannerState.data);

    allKeys.forEach(function(m) {
      var pId = selectedMats[m];
      if (!pId) return;
      var pd = PlannerState.data[m].paralelos[pId];
      if (!pd) return;

      var horarios = [];
      if (PlannerState.viewMode === 'clases') {
        horarios = (pd.horariosTeoricos || pd.horarios || []).concat(pd.horariosPracticos || []);
      }

      pbParseH(horarios).forEach(function(sl) {
        var startMin = sl.s + PB_GRID_SH * 60;
        var endMin   = sl.e + PB_GRID_SH * 60;
        if (startMin < minMinute) minMinute = startMin;
        if (endMin   > maxMinute) maxMinute = endMin;
      });

      if (PlannerState.viewMode !== 'clases') {
        var examKey = {
          'examenes-parcial': 'parcial',
          'examenes-final': 'final',
          'examenes-mejoramiento': 'mejoramiento'
        }[PlannerState.viewMode] || 'parcial';
        var exam = pd.examenes && pd.examenes[examKey];
        if (exam && exam.inicio && exam.fin) {
          var partsI = exam.inicio.split(':').map(Number);
          var partsF = exam.fin.split(':').map(Number);
          var startMin = partsI[0]*60 + partsI[1];
          var endMin   = partsF[0]*60 + partsF[1];
          if (startMin < minMinute) minMinute = startMin;
          if (endMin   > maxMinute) maxMinute = endMin;
        }
      }
    });

    if (minMinute > maxMinute) {
      minMinute = PB_GRID_SH * 60;
      maxMinute = PB_GRID_EH * 60;
    }

    minMinute = Math.max(PB_GRID_SH * 60, minMinute - 30);
    maxMinute = Math.min(PB_GRID_EH * 60, maxMinute + 30);

    var adjustedTotalMinutes = maxMinute - minMinute;
    var adjustedGridHeight   = Math.ceil((adjustedTotalMinutes / 60) * PB_HOUR_PX);

    // ── 2. Guardar estilos originales y tops ──────────────────
    var origRightWidth     = rightPanel.style.width;
    var origRightHeight    = rightPanel.style.height;
    var origRightFlex      = rightPanel.style.flex;
    var origRightOverflow  = rightPanel.style.overflow;
    var origOverflow       = gridScroll.style.overflow;
    var origMaxHeight      = gridScroll.style.maxHeight;
    var origHeight         = gridScroll.style.height;
    var origGridHeight     = scheduleGrid.style.height;
    var origGutterHeight   = gutterEl ? gutterEl.style.height : '';
    var origGutterOverflow = gutterEl ? gutterEl.style.overflow : '';

    // Guardar tops originales
    var origTops = {
      blocks : [],
      lines  : [],
      labels : [],
      cols   : []
    };

    document.querySelectorAll('.ev-block').forEach(function(el) {
      origTops.blocks.push({ el: el, top: el.style.top });
    });
    document.querySelectorAll('.h-line, .hh-line').forEach(function(el) {
      origTops.lines.push({ el: el, top: el.style.top });
    });
    document.querySelectorAll('.t-label').forEach(function(el) {
      origTops.labels.push({ el: el, top: el.style.top, display: el.style.display });
    });
    document.querySelectorAll('.day-col').forEach(function(el) {
      origTops.cols.push({ el: el, height: el.style.height, overflow: el.style.overflow });
    });

    // ── 3. Crear marca de agua y medir ────────────────────────
    var watermark = document.createElement('div');
    watermark.textContent = 'Mi horario – by PoliBaldeo';
    watermark.style.cssText = 'text-align:center;padding:10px 0 6px;font-size:14px;color:var(--text-sub);opacity:0.8;font-family:"Plus Jakarta Sans",sans-serif;';
    rightPanel.appendChild(watermark);
    var watermarkHeight = watermark.offsetHeight;

    // ── 4. Ajustar dimensiones ───────────────────────────────
    var daysHdrHeight = daysHdr.offsetHeight;
    var gridScrollPadding = 24;
    var totalPanelHeight = daysHdrHeight + adjustedGridHeight + gridScrollPadding + watermarkHeight;

    rightPanel.style.width      = '1200px';
    rightPanel.style.height     = totalPanelHeight + 'px';
    rightPanel.style.flex       = 'none';
    rightPanel.style.overflow   = 'hidden';
    gridScroll.style.overflow   = 'visible';
    gridScroll.style.maxHeight  = 'none';
    gridScroll.style.height     = (adjustedGridHeight + gridScrollPadding) + 'px';
    scheduleGrid.style.height   = adjustedGridHeight + 'px';

    if (gutterEl) {
      gutterEl.style.height   = adjustedGridHeight + 'px';
      gutterEl.style.overflow = 'hidden';
    }

    document.querySelectorAll('.day-col').forEach(function(col) {
      col.style.height   = adjustedGridHeight + 'px';
      col.style.overflow = 'hidden';
    });

    // Ocultar etiquetas fuera de rango
    document.querySelectorAll('.t-label').forEach(function(label) {
      var topVal = parseFloat(label.style.top);
      if (topVal > adjustedGridHeight) {
        label.style.display = 'none';
      }
    });

    // ── 5. Desplazar elementos ────────────────────────────────
    var offsetY = (minMinute - PB_GRID_SH * 60) * PB_MIN_PX;
    document.querySelectorAll('.ev-block').forEach(function(blk) {
      blk.style.top = (parseFloat(blk.style.top) - offsetY) + 'px';
    });
    document.querySelectorAll('.h-line, .hh-line').forEach(function(line) {
      line.style.top = (parseFloat(line.style.top) - offsetY) + 'px';
    });
    document.querySelectorAll('.t-label').forEach(function(label) {
      if (label.style.display !== 'none') {
        label.style.top = (parseFloat(label.style.top) - offsetY) + 'px';
      }
    });

    // ── 6. Capturar ──────────────────────────────────────────
    setTimeout(function() {
      htmlToImage.toPng(rightPanel, {
        width: rightPanel.scrollWidth,
        height: rightPanel.scrollHeight,
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#121212'
      }).then(function (dataUrl) {
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'horario_espol_' + new Date().toISOString().slice(0,10) + '.png';
        a.click();
        restoreAll();
        if (btn) btn.disabled = false;
      }).catch(function (error) {
        if (!(error && error.message && (
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError') ||
            error.message.includes('timed out')))) {
          console.error('Error al capturar la imagen:', error);
        }
        restoreAll();
        if (btn) btn.disabled = false;
      });
    }, 150);

    // ── Restauración completa ────────────────────────────────
    function restoreAll() {
      rightPanel.style.width      = origRightWidth;
      rightPanel.style.height     = origRightHeight;
      rightPanel.style.flex       = origRightFlex;
      rightPanel.style.overflow   = origRightOverflow;
      gridScroll.style.overflow   = origOverflow;
      gridScroll.style.maxHeight  = origMaxHeight;
      gridScroll.style.height     = origHeight;
      scheduleGrid.style.height   = origGridHeight;
      if (gutterEl) {
        gutterEl.style.height     = origGutterHeight;
        gutterEl.style.overflow   = origGutterOverflow;
      }
      // Restaurar tops originales
      origTops.blocks.forEach(function(item) { item.el.style.top = item.top; });
      origTops.lines.forEach(function(item)  { item.el.style.top = item.top; });
      origTops.labels.forEach(function(item) {
        item.el.style.top = item.top;
        item.el.style.display = item.display;
      });
      origTops.cols.forEach(function(item) {
        item.el.style.height   = item.height;
        item.el.style.overflow = item.overflow;
      });
      // Quitar marca de agua
      if (rightPanel.contains(watermark)) rightPanel.removeChild(watermark);
      // Redibujar bloques (por si acaso)
      plannerDrawBlocks();
    }
  }

  document.getElementById('btn-capture-image').onclick = _captureScheduleImage;

  // ── Auto-selección de combinación sin conflictos ─────────────

  // ── Función auxiliar para detectar conflictos de clase ───────
  function _hasClassConflict(materia, pId, limitIdx) {
    var data = PlannerState.data;
    var par = data[materia].paralelos[pId];
    var allHorarios = (par.horariosTeoricos || par.horarios || []).concat(par.horariosPracticos || []);
    var slots = pbParseH(allHorarios);
    var mks = pbMatKeys(data);
    var end = (typeof limitIdx === 'number') ? limitIdx : mks.length;
    for (var i = 0; i < end; i++) {
      var sm = mks[i];
      if (sm === materia) continue;
      var selPId = PlannerState.selected[sm];
      if (!selPId) continue;
      var selPar = data[sm].paralelos[selPId];
      var selAllHorarios = (selPar.horariosTeoricos || selPar.horarios || []).concat(selPar.horariosPracticos || []);
      var selSlots = pbParseH(selAllHorarios);
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
    var btn = document.getElementById('btn-auto-select');
    if (btn) btn.disabled = true;

    plannerSetStatus('🎲 Buscando combinación…', 'info');

    // Usar setTimeout para permitir que el DOM se actualice antes del bloqueo
    setTimeout(function() {
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
          if (!hasExamConflict(m, pId) && !_hasClassConflict(m, pId, index)) {
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

      var placed = Object.keys(PlannerState.selected).length;
      finishAutoSelect(placed, total, btn);
    }, 50);
  }

  document.getElementById('btn-auto-select')?.addEventListener('click', function() {
    var hasSelection = Object.keys(PlannerState.selected).length > 0;
    if (hasSelection) {
      plannerConfirm('¿Reemplazar la selección actual por una combinación aleatoria sin conflictos?', function() {
        _autoSelectOptimal();
      });
    } else {
      _autoSelectOptimal();
    }
  });

  // ── Función para finalizar auto-selección ────────────────────

  function finishAutoSelect(placed, total, btn) {
    if (btn) btn.disabled = false;
    if (placed === total) {
      plannerSetStatus('✅ Combinación completa (' + placed + '/' + total + ')', 'success');
    } else {
      plannerSetStatus('⚠️ ' + placed + ' materias colocadas, ' + (total - placed) + ' sin opción', 'warning');
    }
    persistSelection();
  }



  // ── Listener de almacenamiento para actualizaciones en vivo ──

  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local' && changes[PB_STORAGE_KEY] && !PlannerState.isInternalChange) {
      var newData = changes[PB_STORAGE_KEY].newValue;
      var oldData = PlannerState.data;

      // Actualizar datos
      PlannerState.data = newData;
      if (newData._selected && typeof newData._selected === 'object') {
        PlannerState.selected = newData._selected;
      } else {
        PlannerState.selected = {};
      }

      // Limpiar selecciones huérfanas
      var cleaned = false;
      Object.keys(PlannerState.selected).forEach(function(m) {
        if (!newData[m] || !newData[m].paralelos[PlannerState.selected[m]]) {
          delete PlannerState.selected[m];
          cleaned = true;
        }
      });

      if (cleaned) {
        // Persistir la limpieza
        PlannerState.isInternalChange = true;
        pbLoadData(function(data) {
          data._selected = JSON.parse(JSON.stringify(PlannerState.selected));
          pbSaveData(data, function() {
            PlannerState.isInternalChange = false;
          });
        });
      }

      // Determinar tipo de cambio
      var fullRefreshNeeded = false;
      var detailUpdateNeeded = false;

      // Cambios estructurales: diferente número de materias o paralelos
      if (pbMatKeys(newData).length !== pbMatKeys(oldData).length) {
        fullRefreshNeeded = true;
      } else {
        pbMatKeys(newData).forEach(function(m) {
          if (!oldData[m] || pbParKeys(oldData[m]).length !== pbParKeys(newData[m]).length) {
            fullRefreshNeeded = true;
          }
        });
      }

      // Si no es estructural, verificar cambios de orden o detalles
      if (!fullRefreshNeeded) {
        // Comparar orden de materias
        if (JSON.stringify(newData._order) !== JSON.stringify(oldData._order)) {
          fullRefreshNeeded = true;
        } else {
          // Comparar orden de paralelos y contenido de cada paralelo
          pbMatKeys(newData).forEach(function(m) {
            if (!fullRefreshNeeded && JSON.stringify(newData[m]._pOrder) !== JSON.stringify(oldData[m]._pOrder)) {
              fullRefreshNeeded = true; // cambio de orden de paralelos requiere rebuild
            }
          });
        }
      }

      // Si aún no es necesario reconstruir, verificar cambios en detalles de paralelos
      if (!fullRefreshNeeded) {
        pbMatKeys(newData).forEach(function(m) {
          var newPar = newData[m].paralelos;
          var oldPar = oldData[m] ? oldData[m].paralelos : {};
          Object.keys(newPar).forEach(function(p) {
            if (!fullRefreshNeeded && JSON.stringify(newPar[p]) !== JSON.stringify(oldPar[p])) {
              detailUpdateNeeded = true; // solo actualizar los textos de los items
            }
          });
        });
      }

      // Verificar cambios en créditos o collapsed
      if (!fullRefreshNeeded && !detailUpdateNeeded) {
        pbMatKeys(newData).forEach(function(m) {
          if ((newData[m].creditos || '0') !== ((oldData[m] && oldData[m].creditos) || '0')) {
            detailUpdateNeeded = true;
          }
          if ((newData[m].collapsed) !== ((oldData[m] && oldData[m].collapsed) || false)) {
            detailUpdateNeeded = true;
          }
        });
      }

      if (fullRefreshNeeded) {
        plannerFullRefresh();
      } else if (detailUpdateNeeded) {
        updateParaleloDetails();
        plannerDrawBlocks();
        plannerUpdateFooter();
      } else {
        plannerRefresh();
      }
    }
  });

  // ── Arranque ─────────────────────────────────────────────────
  init();

})();