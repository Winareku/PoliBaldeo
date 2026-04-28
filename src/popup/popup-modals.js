/* ============================================================
   Polibaldeo – popup/popup-modals.js
   Modales para edición de paralelos, materias y confirmación.
   Depende de: popup-state.js, popup-toasts.js, modal.js
   ============================================================ */

"use strict";

// ═══════════════════════════════════════════════════════════════
//  Helpers de horario e info
// ═══════════════════════════════════════════════════════════════

function pbParseHorarioStr(h) {
  var clean = pbStripSec(h);
  var m = clean.match(/^(\S+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  return m ? { day: m[1], start: m[2], end: m[3] } : null;
}

function pbParseInfo(info) {
  var prof = '', ubic = '';
  (info || '').split('\n').forEach(function(l) {
    var lt = l.trim();
    if (/^Profesor:/i.test(lt))     prof = lt.replace(/^Profesor:/i, '').trim();
    if (/^Ubicaci[oó]n:/i.test(lt)) ubic = lt.replace(/^Ubicaci[oó]n:/i, '').trim();
  });
  return { prof: prof, ubic: ubic };
}

function pbBuildInfo(prof, ubic) {
  var parts = [];
  if (prof) parts.push('Profesor: ' + prof);
  if (ubic) parts.push('Ubicación: ' + ubic);
  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  Diálogo de confirmación (con PBModal)
// ═══════════════════════════════════════════════════════════════

function pbConfirm(msg, onOk, onCancel) {
  var modal = PBModal.create({
    title: 'Confirmar',
    body: '<p style="font-size:14px;line-height:1.5;color:var(--text-main);">' + msg.replace(/\n/g, '<br>') + '</p>',
    footer: `
      <button class="btn btn-outline" id="modal-cancel">Cancelar</button>
      <button class="btn btn-primary" id="modal-ok">Confirmar</button>
    `
  });

  modal.open();

  modal.getElement('#modal-cancel').onclick = function() {
    modal.destroy();
    if (typeof onCancel === 'function') onCancel();
  };

  modal.getElement('#modal-ok').onclick = function() {
    modal.destroy();
    if (typeof onOk === 'function') onOk();
  };

  modal.root.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      modal.destroy();
      if (typeof onCancel === 'function') onCancel();
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  Edición inline del nombre de materia
// ═══════════════════════════════════════════════════════════════

function popupStartNameEdit(nameEl, card) {
  var oldName = nameEl.textContent;
  var input   = document.createElement('input');
  input.type      = 'text';
  input.className = 'materia-name-input';
  input.value     = oldName;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  var finished = false;
  function finish(save) {
    if (finished) return;
    finished = true;

    var newName  = input.value.trim();
    var restored = document.createElement('span');
    restored.className = 'materia-name';
    restored.onclick   = function() { popupStartNameEdit(restored, card); };

    if (save && newName && newName !== oldName) {
      if (PopupState.currentData[newName]) {
        popupSetStatus('⚠️ Ya existe una materia con ese nombre', 'warning');
        restored.textContent = oldName;
        restored.title       = oldName;
      } else {
        PopupState.currentData[newName] = PopupState.currentData[oldName];
        delete PopupState.currentData[oldName];
        var ord = PopupState.currentData._order;
        if (ord) {
          var idx = ord.indexOf(oldName);
          if (idx >= 0) ord[idx] = newName;
        }
        card.dataset.materia = newName;
        restored.textContent = newName;
        restored.title       = newName;
        popupSaveVisualState();
        popupSetStatus('✅ Nombre actualizado', 'success');
        // Transferir color en _colorMap
        if (PopupState.currentData._colorMap) {
          PopupState.currentData._colorMap[newName] = PopupState.currentData._colorMap[oldName] || popupColorMap[oldName];
          delete PopupState.currentData._colorMap[oldName];
        }
        // Transferir color local
        popupColorMap[newName] = popupColorMap[oldName];
        delete popupColorMap[oldName];
        // Reconstruir todas las tarjetas para actualizar event listeners
        popupRender(PopupState.currentData);
      }
    } else {
      restored.textContent = oldName;
      restored.title       = oldName;
    }

    input.replaceWith(restored);
  }

  input.onblur    = function()  { finish(true); };
  input.onkeydown = function(e) {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  };
}

// ═══════════════════════════════════════════════════════════════
//  Generador de ID para próximo paralelo
// ═══════════════════════════════════════════════════════════════

function _pbNextParId(materia) {
  var mat  = PopupState.currentData[materia];
  var keys = mat && mat.paralelos ? Object.keys(mat.paralelos) : [];
  if (!keys.length) return '1';
  var nums = keys.map(function(k) { return parseInt(k, 10); }).filter(function(n) { return !isNaN(n); });
  return nums.length ? String(Math.max.apply(null, nums) + 1) : String(keys.length + 1);
}

// ═══════════════════════════════════════════════════════════════
//  Modal de edición de paralelo (con PBModal)
// ═══════════════════════════════════════════════════════════════

function popupOpenEditModal(materia, pId, isNew) {
  EditModalState.materia = materia;
  EditModalState.oldPId  = pId;
  EditModalState.isNew   = !!isNew;

  var parData = {};
  if (!isNew && materia && pId) {
    parData = (PopupState.currentData[materia] &&
               PopupState.currentData[materia].paralelos &&
               PopupState.currentData[materia].paralelos[pId]) || {};
  }

  var parNum = isNew ? _pbNextParId(materia) : (pId || '');

  // Obtener profesor y ubicación (separados o del campo info antiguo)
  var prof = parData.profesor || '';
  var ubic = parData.ubicacion || '';
  if (!prof && !ubic) {
    // Fallback: parsear del info antiguo si es necesario
    var parsed = pbParseInfo(parData.info || '');
    prof = parsed.prof;
    ubic = parsed.ubic;
  }

  // Obtener exámenes existentes
  var examData = parData.examenes || {};
  var parcial = examData.parcial || { fecha: '', inicio: '', fin: '' };
  var final   = examData.final   || { fecha: '', inicio: '', fin: '' };
  var mejora  = examData.mejoramiento || { fecha: '', inicio: '', fin: '' };

  var horariosRows = '';
  (parData.horarios || []).forEach(function(h) {
    var p = pbParseHorarioStr(h);
    if (p) {
      horariosRows += `
        <div class="pb-h-row">
          <select class="pb-day-sel">
            ${Object.keys(PB_DAY_MAP).map(function(d) {
              return '<option value="' + d + '"' + (d === p.day ? ' selected' : '') + '>' + d + '</option>';
            }).join('')}
          </select>
          <input type="text" class="pb-time-input pb-start" placeholder="HH:MM" maxlength="5" value="${p.start}">
          <span class="pb-h-sep">–</span>
          <input type="text" class="pb-time-input pb-end" placeholder="HH:MM" maxlength="5" value="${p.end}">
          <button class="pb-h-del" type="button" title="Eliminar horario"><span class="sym">delete</span></button>
        </div>
      `;
    }
  });

  var bodyHTML = `
    <div class="pb-field-row">
      <span class="pb-field-label">Paralelo</span>
      <input id="pb-par-num" type="text" class="pb-text-input" value="${parNum}" style="max-width:70px;">
    </div>
    <div class="pb-field-row">
      <span class="pb-field-label">Profesor</span>
      <input id="pb-prof-input" type="text" class="pb-text-input" placeholder="Nombre del profesor" value="${prof.replace(/"/g, '&quot;')}">
    </div>
    <div class="pb-field-row">
      <span class="pb-field-label">Ubicación</span>
      <input id="pb-ubic-input" type="text" class="pb-text-input" placeholder="Aula o edificio" value="${ubic.replace(/"/g, '&quot;')}">
    </div>
    <div class="pb-section-hdr">
      <span>Horarios</span>
      <button class="pb-add-btn" id="pb-add-horario" type="button" title="Añadir horario">
        <span class="sym" style="font-size:16px">add</span>
      </button>
    </div>
    <div id="pb-horarios-container">${horariosRows}</div>

    <!-- Sección Exámenes -->
    <div class="pb-section-hdr" style="margin-top:12px;">
      <span>Exámenes</span>
    </div>
    <div id="pb-examenes-container" style="display:flex; flex-direction:column; gap:8px;">
      <!-- Parcial -->
      <div class="pb-h-row">
        <input type="text" class="pb-text-input exam-fecha" id="exam-parcial-fecha" placeholder="YYYY-MM-DD" value="${parcial.fecha}" style="max-width:130px;" pattern="\\d{4}-\\d{2}-\\d{2}">
        <input type="text" class="pb-time-input" id="exam-parcial-inicio" placeholder="HH:MM" maxlength="5" value="${parcial.inicio}" style="width:65px;">
        <span class="pb-h-sep">–</span>
        <input type="text" class="pb-time-input" id="exam-parcial-fin" placeholder="HH:MM" maxlength="5" value="${parcial.fin}" style="width:65px;">
        <input type="text" class="pb-text-input" id="exam-parcial-aula" placeholder="Aula" value="${parcial.aula || ''}" style="max-width:130px;">
      </div>
      <!-- Final -->
      <div class="pb-h-row">
        <input type="text" class="pb-text-input exam-fecha" id="exam-final-fecha" placeholder="YYYY-MM-DD" value="${final.fecha}" style="max-width:130px;" pattern="\\d{4}-\\d{2}-\\d{2}">
        <input type="text" class="pb-time-input" id="exam-final-inicio" placeholder="HH:MM" maxlength="5" value="${final.inicio}" style="width:65px;">
        <span class="pb-h-sep">–</span>
        <input type="text" class="pb-time-input" id="exam-final-fin" placeholder="HH:MM" maxlength="5" value="${final.fin}" style="width:65px;">
        <input type="text" class="pb-text-input" id="exam-final-aula" placeholder="Aula" value="${final.aula || ''}" style="max-width:130px;">
      </div>
      <!-- Mejoramiento -->
      <div class="pb-h-row">
        <input type="text" class="pb-text-input exam-fecha" id="exam-mejora-fecha" placeholder="YYYY-MM-DD" value="${mejora.fecha}" style="max-width:130px;" pattern="\\d{4}-\\d{2}-\\d{2}">
        <input type="text" class="pb-time-input" id="exam-mejora-inicio" placeholder="HH:MM" maxlength="5" value="${mejora.inicio}" style="width:65px;">
        <span class="pb-h-sep">–</span>
        <input type="text" class="pb-time-input" id="exam-mejora-fin" placeholder="HH:MM" maxlength="5" value="${mejora.fin}" style="width:65px;">
        <input type="text" class="pb-text-input" id="exam-mejora-aula" placeholder="Aula" value="${mejora.aula || ''}" style="max-width:130px;">
      </div>
    </div>
  `;

  var modal = PBModal.create({
    title: isNew ? 'Nuevo Paralelo' : 'Editar Paralelo',
    body: bodyHTML,
    footer: `
      <button class="btn btn-outline" id="modal-cancel">Cancelar</button>
      <button class="btn btn-primary" id="modal-save">Guardar</button>
    `
  });

  modal.open();

  // Ajustar tamaño del modal
  var modalCard = modal.root.querySelector('.modal-card');
  if (modalCard) {
    modalCard.style.maxWidth = '540px';
  }
  var modalBody = modal.root.querySelector('.modal-body');
  if (modalBody) {
    modalBody.style.maxHeight = '520px';
  }

  var parInput = modal.getElement('#pb-par-num');
  var profInput = modal.getElement('#pb-prof-input');
  var ubicInput = modal.getElement('#pb-ubic-input');
  var container = modal.getElement('#pb-horarios-container');

  modal.getElement('#pb-add-horario').onclick = function() {
    var row = document.createElement('div');
    row.className = 'pb-h-row';
    row.innerHTML = `
      <select class="pb-day-sel">
        ${Object.keys(PB_DAY_MAP).map(function(d) { return '<option>' + d + '</option>'; }).join('')}
      </select>
      <input type="text" class="pb-time-input pb-start" placeholder="HH:MM" maxlength="5">
      <span class="pb-h-sep">–</span>
      <input type="text" class="pb-time-input pb-end" placeholder="HH:MM" maxlength="5">
      <button class="pb-h-del" type="button" title="Eliminar horario"><span class="sym">delete</span></button>
    `;
    row.querySelector('.pb-h-del').onclick = function() { row.remove(); };
    container.appendChild(row);
  };

  container.addEventListener('click', function(e) {
    var delBtn = e.target.closest('.pb-h-del');
    if (delBtn) {
      delBtn.closest('.pb-h-row').remove();
    }
  });

  modal.getElement('#modal-save').onclick = function() {
    var newPId = parInput.value.trim();
    if (!newPId) {
      popupSetStatus('⚠️ El paralelo no puede estar vacío', 'warning');
      return;
    }

    var prof = profInput.value.replace(/\n/g, ' ').trim();
    var ubic = ubicInput.value.replace(/\n/g, ' ').trim();

    var horarios = [];
    var rows = container.querySelectorAll('.pb-h-row');
    var daySchedules = {};

    for (var i = 0; i < rows.length; i++) {
      var day = rows[i].querySelector('.pb-day-sel').value;
      var start = rows[i].querySelector('.pb-start').value.trim();
      var end = rows[i].querySelector('.pb-end').value.trim();
      if (!day || !start || !end) continue;

      if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) {
        popupSetStatus('⚠️ Formato de hora inválido en ' + day + ' (usa HH:MM)', 'warning');
        return;
      }

      start = start.padStart(5, '0');
      end = end.padStart(5, '0');

      var sParts = start.split(':');
      var eParts = end.split(':');
      var sMins = parseInt(sParts[0], 10) * 60 + parseInt(sParts[1], 10);
      var eMins = parseInt(eParts[0], 10) * 60 + parseInt(eParts[1], 10);

      if (eMins <= sMins) {
        popupSetStatus('⚠️ En el ' + day + ', la hora de fin debe ser mayor a la de inicio', 'warning');
        return;
      }

      if (!daySchedules[day]) daySchedules[day] = [];
      for (var j = 0; j < daySchedules[day].length; j++) {
        var block = daySchedules[day][j];
        if (sMins < block.e && eMins > block.s) {
          popupSetStatus('⚠️ Hay un cruce de horas el día ' + day, 'warning');
          return;
        }
      }
      daySchedules[day].push({s: sMins, e: eMins});
      horarios.push(day + ' ' + start + '-' + end);
    }

    // Leer exámenes
    var examenesNuevos = {};
    function readExam(prefix) {
      var fecha = modal.getElement('#exam-' + prefix + '-fecha')?.value || '';
      var inicio = modal.getElement('#exam-' + prefix + '-inicio')?.value || '';
      var fin = modal.getElement('#exam-' + prefix + '-fin')?.value || '';
      var aula = modal.getElement('#exam-' + prefix + '-aula')?.value.trim() || '';
      if (fecha && inicio && fin) {
        return { fecha: fecha, inicio: inicio, fin: fin, aula: aula };
      }
      return null;
    }
    var p = readExam('parcial');
    if (p) examenesNuevos.parcial = p;
    var f = readExam('final');
    if (f) examenesNuevos.final = f;
    var m = readExam('mejora');
    if (m) examenesNuevos.mejoramiento = m;

    var parDataNew = {
      horarios: horarios,
      profesor: prof,
      ubicacion: ubic,
      examenes: examenesNuevos
    };
    var mat = PopupState.currentData[materia];
    if (!mat.paralelos) mat.paralelos = {};
    if (!mat._pOrder)   mat._pOrder   = [];

    if (isNew) {
      if (mat.paralelos[newPId]) {
        popupSetStatus('⚠️ Ya existe ese número de paralelo', 'warning');
        return;
      }
      mat.paralelos[newPId] = parDataNew;
      mat._pOrder.push(newPId);
    } else if (newPId !== pId) {
      if (mat.paralelos[newPId]) {
        popupSetStatus('⚠️ Ya existe ese número de paralelo', 'warning');
        return;
      }
      var idx = mat._pOrder.indexOf(pId);
      if (idx >= 0) mat._pOrder.splice(idx, 1, newPId);
      else mat._pOrder.push(newPId);
      delete mat.paralelos[pId];
      mat.paralelos[newPId] = parDataNew;
    } else {
      mat.paralelos[pId] = parDataNew;
    }

    modal.destroy();
    PopupState.isInternalChange = true;
    pbSaveData(PopupState.currentData, function() {
      PopupState.isInternalChange = false;
      popupRender(PopupState.currentData);
      popupSetStatus('✅ Paralelo guardado', 'success');
    });
  };

  modal.getElement('#modal-cancel').onclick = function() {
    modal.destroy();
  };

  parInput.focus();
}

// ═══════════════════════════════════════════════════════════════
//  Modal de creación de materia (con PBModal)
// ═══════════════════════════════════════════════════════════════

var _materiaCredVal = 0;

function popupOpenMateriaModal() {
  _materiaCredVal = 0;
  var bodyHTML = `
    <div class="pb-field-row">
      <span class="pb-field-label">Nombre</span>
      <input id="pb-materia-name-input" type="text" class="pb-text-input" placeholder="Nombre de la materia">
    </div>
    <div class="pb-field-row">
      <span class="pb-field-label">Créditos</span>
      <div class="pb-par-stepper">
        <button type="button" id="pb-materia-cred-minus">−</button>
        <span id="pb-materia-cred-val" style="min-width:32px;text-align:center;font-weight:700;font-size:13px">0</span>
        <button type="button" id="pb-materia-cred-plus">+</button>
      </div>
    </div>
  `;

  var modal = PBModal.create({
    title: 'Nueva Materia',
    body: bodyHTML,
    footer: `
      <button class="btn btn-outline" id="modal-cancel">Cancelar</button>
      <button class="btn btn-primary" id="modal-save">Añadir</button>
    `
  });

  modal.open();

  var nameInput = modal.getElement('#pb-materia-name-input');
  var credSpan = modal.getElement('#pb-materia-cred-val');

  modal.getElement('#pb-materia-cred-minus').onclick = function() {
    if (_materiaCredVal > 0) {
      _materiaCredVal--;
      credSpan.textContent = _materiaCredVal;
    }
  };
  modal.getElement('#pb-materia-cred-plus').onclick = function() {
    _materiaCredVal++;
    credSpan.textContent = _materiaCredVal;
  };

  nameInput.onkeydown = function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      modal.getElement('#modal-save').click();
    }
  };

  modal.getElement('#modal-save').onclick = function() {
    var name = nameInput.value.trim();
    if (!name) {
      popupSetStatus('⚠️ El nombre no puede estar vacío', 'warning');
      return;
    }
    if (PopupState.currentData[name]) {
      popupSetStatus('⚠️ Ya existe una materia con ese nombre', 'warning');
      return;
    }

    PopupState.currentData[name] = {
      creditos: String(_materiaCredVal),
      paralelos: {},
      _pOrder: [],
      collapsed: false
    };
    if (!PopupState.currentData._order) PopupState.currentData._order = [];
    PopupState.currentData._order.push(name);

    modal.destroy();
    PopupState.isInternalChange = true;
    pbSaveData(PopupState.currentData, function() {
      PopupState.isInternalChange = false;
      popupRender(PopupState.currentData);
      popupSetStatus('✅ Materia añadida', 'success');
    });
  };

  modal.getElement('#modal-cancel').onclick = function() {
    modal.destroy();
  };

  nameInput.focus();
}
