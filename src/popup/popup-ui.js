/* ============================================================
   Polibaldeo – popup/popup-ui.js  (v3)
   Renderizado del Popup + modales de edición con PBModal.
   Requiere: utils.js, storage.js, exporter.js, modal.js
   ============================================================ */

"use strict";

// ── Estado del Popup ─────────────────────────────────────────
var PopupState = {
  currentData     : {},
  isInternalChange: false
};

// ── Estado del modal de edición ───────────────────────────────
var EditModalState = {
  materia : null,
  oldPId  : null,
  isNew   : false
};

// ═══════════════════════════════════════════════════════════════
//  Helpers de horario e info
// ═══════════════════════════════════════════════════════════════

function pbStripSec(h) {
  return (h || '').replace(/(\d{2}:\d{2}):\d{2}/g, '$1');
}

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
//  Toast System unificado
// ═══════════════════════════════════════════════════════════════

var _activeToasts = [];

function _removeToastEntry(entry, immediate) {
  if (!entry || !entry.el) return;
  clearTimeout(entry.timer);
  var idx = _activeToasts.indexOf(entry);
  if (idx > -1) _activeToasts.splice(idx, 1);

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
 * Muestra un toast simple (éxito, advertencia, info).
 * @param {string} msg
 * @param {string} type - 'success', 'warning', 'info'
 */
function popupSetStatus(msg, type) {
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

  closeBtn.onclick = function() {
    _removeToastEntry(entry, false);
  };

  entry.timer = setTimeout(function() {
    _removeToastEntry(entry, false);
  }, 4000);

  _activeToasts.push(entry);
}

/**
 * Muestra un toast con botón "Deshacer".
 * @param {string}   msg       Texto a mostrar
 * @param {Function} undoFn    Callback si el usuario pulsa Deshacer
 */
function pbShowUndoToast(msg, undoFn) {
  var container = document.getElementById('toast-container');
  if (!container) return;

  while (_activeToasts.length >= 3) {
    var oldest = _activeToasts.shift();
    _removeToastEntry(oldest, true);
  }

  var toast = document.createElement('div');
  toast.className = 'pb-toast info';

  var msgSpan = document.createElement('span');
  msgSpan.className = 'toast-msg';
  msgSpan.textContent = msg;

  var undoBtn = document.createElement('button');
  undoBtn.className = 'toast-action';
  undoBtn.textContent = 'Deshacer';

  var closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Cerrar');

  toast.appendChild(msgSpan);
  toast.appendChild(undoBtn);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  var entry = { el: toast, timer: null, undone: false };

  var removeToast = function(immediate) {
    _removeToastEntry(entry, immediate);
  };

  undoBtn.onclick = function() {
    if (entry.undone) return;
    entry.undone = true;
    removeToast(false);
    if (typeof undoFn === 'function') undoFn();
  };

  closeBtn.onclick = function() {
    removeToast(false);
  };

  entry.timer = setTimeout(function() {
    removeToast(false);
  }, 5000);

  _activeToasts.push(entry);
}

// ═══════════════════════════════════════════════════════════════
//  Colapsar / Expandir todo
// ═══════════════════════════════════════════════════════════════

function popupToggleCollapseAll() {
  var anyExpanded    = !!document.querySelector('.materia-card:not(.collapsed)');
  var shouldCollapse = anyExpanded;

  document.querySelectorAll('.materia-card').forEach(function(card) {
    card.classList.toggle('collapsed', shouldCollapse);
  });

  var btn = document.getElementById('btn-collapse-all');
  if (btn) {
    btn.querySelector('.sym').textContent = shouldCollapse ? 'unfold_more' : 'unfold_less';
    btn.title = shouldCollapse ? 'Expandir todas' : 'Colapsar todas';
  }

  popupSaveVisualState();
}

// ═══════════════════════════════════════════════════════════════
//  Persistencia desde la UI
// ═══════════════════════════════════════════════════════════════

function popupSaveVisualState() {
  PopupState.isInternalChange = true;
  var newData = { _order: [] };

  document.querySelectorAll('.materia-card').forEach(function(card) {
    var nombre    = card.dataset.materia;
    var cred      = card.querySelector('.creditos-value').textContent;
    var collapsed = card.classList.contains('collapsed');
    newData._order.push(nombre);
    newData[nombre] = { creditos: cred, paralelos: {}, _pOrder: [], collapsed: collapsed };

    card.querySelectorAll('.paralelo-item').forEach(function(item) {
      var pNum = item.dataset.paralelo;
      newData[nombre]._pOrder.push(pNum);
      var existingData = PopupState.currentData[nombre] &&
                         PopupState.currentData[nombre].paralelos &&
                         PopupState.currentData[nombre].paralelos[pNum];
      if (existingData) {
        newData[nombre].paralelos[pNum] = existingData;
      }
    });
  });

  PopupState.currentData = newData;
  pbSaveData(newData, function() {
    PopupState.isInternalChange = false;
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
//  Modal de edición de paralelo (con PBModal)
// ═══════════════════════════════════════════════════════════════

function _pbNextParId(materia) {
  var mat  = PopupState.currentData[materia];
  var keys = mat && mat.paralelos ? Object.keys(mat.paralelos) : [];
  if (!keys.length) return '1';
  var nums = keys.map(function(k) { return parseInt(k, 10); }).filter(function(n) { return !isNaN(n); });
  return nums.length ? String(Math.max.apply(null, nums) + 1) : String(keys.length + 1);
}

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

  var parsed = pbParseInfo(parData.info || '');
  var parNum = isNew ? _pbNextParId(materia) : (pId || '');

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
      <div class="pb-par-stepper">
        <button id="pb-par-minus" type="button">−</button>
        <input id="pb-par-num" type="text" class="pb-par-num-input" value="${parNum}">
        <button id="pb-par-plus" type="button">+</button>
      </div>
    </div>
    <div class="pb-field-row">
      <span class="pb-field-label">Profesor</span>
      <input id="pb-prof-input" type="text" class="pb-text-input" placeholder="Nombre del profesor" value="${parsed.prof.replace(/"/g, '&quot;')}">
    </div>
    <div class="pb-field-row">
      <span class="pb-field-label">Ubicación</span>
      <input id="pb-ubic-input" type="text" class="pb-text-input" placeholder="Aula o edificio" value="${parsed.ubic.replace(/"/g, '&quot;')}">
    </div>
    <div class="pb-section-hdr">
      <span>Horarios</span>
      <button class="pb-add-btn" id="pb-add-horario" type="button" title="Añadir horario">
        <span class="sym" style="font-size:16px">add</span>
      </button>
    </div>
    <div id="pb-horarios-container">${horariosRows}</div>
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

  var parInput = modal.getElement('#pb-par-num');
  var profInput = modal.getElement('#pb-prof-input');
  var ubicInput = modal.getElement('#pb-ubic-input');
  var container = modal.getElement('#pb-horarios-container');

  modal.getElement('#pb-par-minus').onclick = function() {
    var v = parseInt(parInput.value, 10);
    if (!isNaN(v) && v > 1) parInput.value = String(v - 1);
  };
  modal.getElement('#pb-par-plus').onclick = function() {
    var v = parseInt(parInput.value, 10);
    parInput.value = isNaN(v) ? '1' : String(v + 1);
  };

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

    var parDataNew = { horarios: horarios, info: pbBuildInfo(prof, ubic) };
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

// ═══════════════════════════════════════════════════════════════
//  Construcción de items de paralelo
// ═══════════════════════════════════════════════════════════════

function popupBuildParaleloItem(nombreMateria, nParalelo, data, parentList) {
  var item = document.createElement('div');
  item.className = 'paralelo-item';
  item.dataset.paralelo = nParalelo;

  var profLine = (data.info || '').split('\n').find(function(l) {
    return l.includes('Profesor:');
  }) || '';
  var prof = profLine.replace('Profesor:', '').trim() || 'Sin profesor';

  var paraleloTop = document.createElement('div');
  paraleloTop.className = 'paralelo-top';

  var dragHandle = document.createElement('span');
  dragHandle.className = 'drag-handle';
  dragHandle.title = 'Arrastrar';
  var symDrag = document.createElement('span');
  symDrag.className = 'sym';
  symDrag.textContent = 'drag_indicator';
  dragHandle.appendChild(symDrag);

  var paraleloBadge = document.createElement('span');
  paraleloBadge.className = 'paralelo-badge';
  paraleloBadge.textContent = 'Par. ' + nParalelo;

  var paraleloProf = document.createElement('span');
  paraleloProf.className = 'paralelo-prof';
  paraleloProf.textContent = prof;

  var paraleloEdit = document.createElement('button');
  paraleloEdit.className = 'paralelo-edit';
  paraleloEdit.type = 'button';
  paraleloEdit.title = 'Editar';
  var symEdit = document.createElement('span');
  symEdit.className = 'sym';
  symEdit.style.fontSize = '15px';
  symEdit.textContent = 'edit';
  paraleloEdit.appendChild(symEdit);

  var paraleloDelete = document.createElement('button');
  paraleloDelete.className = 'paralelo-delete';
  paraleloDelete.type = 'button';
  paraleloDelete.title = 'Eliminar';
  paraleloDelete.textContent = '✕';

  paraleloTop.append(dragHandle, paraleloBadge, paraleloProf, paraleloEdit, paraleloDelete);

  var horarioTags = document.createElement('div');
  horarioTags.className = 'horario-tags';
  (data.horarios || []).forEach(function(h) {
    var tag = document.createElement('span');
    tag.className = 'horario-tag';
    tag.textContent = pbStripSec(h);
    horarioTags.appendChild(tag);
  });

  item.append(paraleloTop, horarioTags);

  pbInitDragHandle(item.querySelector('.drag-handle'), item, parentList, popupSaveVisualState);

  item.querySelector('.paralelo-edit').onclick = function(e) {
    e.stopPropagation();
    popupOpenEditModal(nombreMateria, nParalelo, false);
  };
  item.querySelector('.paralelo-delete').onclick = function() {
    var savedData = JSON.parse(JSON.stringify(data));
    var savedIdx = Array.from(parentList.querySelectorAll('.paralelo-item')).indexOf(item);

    item.remove();
    if (parentList.querySelectorAll('.paralelo-item').length === 0) {
      var emptyMsg = document.createElement('div');
      emptyMsg.className = 'paralelo-empty';
      emptyMsg.textContent = 'Sin paralelos – Agrega uno';
      emptyMsg.style.cssText = 'padding:10px; text-align:center; color:var(--on-surf-var); font-size:12px; font-style:italic;';
      parentList.appendChild(emptyMsg);
    }
    popupSaveVisualState();
    popupUpdateCounter();

    pbShowUndoToast('Paralelo ' + nParalelo + ' eliminado', function() {
      var mat = PopupState.currentData[nombreMateria];
      if (!mat) return;
      if (!mat.paralelos) mat.paralelos = {};
      mat.paralelos[nParalelo] = savedData;
      if (!mat._pOrder) mat._pOrder = [];
      if (mat._pOrder.indexOf(nParalelo) < 0) {
        mat._pOrder.splice(savedIdx, 0, nParalelo);
      }
      PopupState.isInternalChange = true;
      pbSaveData(PopupState.currentData, function() {
        PopupState.isInternalChange = false;
        popupRender(PopupState.currentData);
      });
    });
  };

  return item;
}

// ═══════════════════════════════════════════════════════════════
//  Construcción de tarjetas de materia
// ═══════════════════════════════════════════════════════════════

function popupBuildMateriaCard(nombre, mat) {
  var card             = document.createElement('div');
  card.className       = 'materia-card' + (mat.collapsed ? ' collapsed' : '');
  card.dataset.materia = nombre;

  var hdr       = document.createElement('div');
  hdr.className = 'materia-header';

  var dragH       = document.createElement('span');
  dragH.className = 'drag-handle';
  dragH.title     = 'Arrastrar para reordenar';
  var symDrag     = document.createElement('span');
  symDrag.className = 'sym';
  symDrag.textContent = 'drag_indicator';
  dragH.appendChild(symDrag);
  var materiasList = document.getElementById('materias-list');
  pbInitDragHandle(dragH, card, materiasList, popupSaveVisualState);

  var nameEl         = document.createElement('span');
  nameEl.className   = 'materia-name';
  nameEl.textContent = nombre;
  nameEl.title       = nombre;
  nameEl.onclick     = function() { popupStartNameEdit(nameEl, card); };

  var stepper          = document.createElement('div');
  stepper.className    = 'creditos-stepper';
  var btnMinus         = document.createElement('button');
  btnMinus.textContent = '−';
  btnMinus.type        = 'button';
  var valSpan          = document.createElement('span');
  valSpan.className    = 'creditos-value';
  valSpan.textContent  = mat.creditos || '0';
  var btnPlus          = document.createElement('button');
  btnPlus.textContent  = '+';
  btnPlus.type         = 'button';
  var updateCredit = function(delta) {
    var v = Math.max(0, (parseInt(valSpan.textContent, 10) || 0) + delta);
    valSpan.textContent = v;
    popupSaveVisualState();
  };
  btnMinus.onclick = function(e) { e.stopPropagation(); updateCredit(-1); };
  btnPlus.onclick  = function(e) { e.stopPropagation(); updateCredit(+1); };
  stepper.append(btnMinus, valSpan, btnPlus);

  var addBtn       = document.createElement('button');
  addBtn.className = 'ctrl-btn add-par-btn';
  addBtn.type      = 'button';
  addBtn.title     = 'Añadir paralelo';
  var symAdd       = document.createElement('span');
  symAdd.className = 'sym';
  symAdd.style.fontSize = '16px';
  symAdd.textContent = 'add_circle';
  addBtn.appendChild(symAdd);
  addBtn.onclick   = function(e) {
    e.stopPropagation();
    popupOpenEditModal(nombre, null, true);
  };

  var delMatBtn       = document.createElement('button');
  delMatBtn.className = 'ctrl-btn';
  delMatBtn.type      = 'button';
  delMatBtn.title     = 'Eliminar materia';
  var symDel          = document.createElement('span');
  symDel.className    = 'sym';
  symDel.style.fontSize = '16px';
  symDel.style.color = 'var(--error)';
  symDel.textContent = 'delete';
  delMatBtn.appendChild(symDel);
  delMatBtn.onclick   = function(e) {
    e.stopPropagation();
    var savedMatData = JSON.parse(JSON.stringify(PopupState.currentData[nombre]));
    var savedIdx     = PopupState.currentData._order ? PopupState.currentData._order.indexOf(nombre) : -1;

    card.remove();
    delete PopupState.currentData[nombre];
    var orderIdx = PopupState.currentData._order ? PopupState.currentData._order.indexOf(nombre) : -1;
    if (orderIdx > -1) PopupState.currentData._order.splice(orderIdx, 1);
    popupSaveVisualState();
    popupUpdateCounter();
    if (document.querySelectorAll('.materia-card').length === 0) {
      popupRender(PopupState.currentData);
    }

    pbShowUndoToast('"' + nombre + '" eliminada', function() {
      PopupState.currentData[nombre] = savedMatData;
      if (!PopupState.currentData._order) PopupState.currentData._order = [];
      if (savedIdx >= 0 && savedIdx <= PopupState.currentData._order.length) {
        PopupState.currentData._order.splice(savedIdx, 0, nombre);
      } else {
        PopupState.currentData._order.push(nombre);
      }
      PopupState.isInternalChange = true;
      pbSaveData(PopupState.currentData, function() {
        PopupState.isInternalChange = false;
        popupRender(PopupState.currentData);
      });
    });
  };

  var collapseBtn         = document.createElement('button');
  collapseBtn.className   = 'ctrl-btn';
  collapseBtn.type        = 'button';
  collapseBtn.textContent = '▼';
  collapseBtn.onclick     = function() {
    card.classList.toggle('collapsed');
    popupSaveVisualState();
  };

  hdr.append(dragH, nameEl, stepper, addBtn, delMatBtn, collapseBtn);
  card.appendChild(hdr);

  var list       = document.createElement('div');
  list.className = 'paralelo-list';

  var allP  = Object.keys(mat.paralelos || {});
  var pOrd  = mat._pOrder || [];
  var pKeys = Array.from(new Set(
    pOrd.filter(function(p) { return allP.includes(p); })
        .concat(allP.filter(function(p) { return !pOrd.includes(p); }))
  ));
  pKeys.forEach(function(pNum) {
    list.appendChild(popupBuildParaleloItem(nombre, pNum, mat.paralelos[pNum], list));
  });

  if (pKeys.length === 0) {
    var emptyMsg = document.createElement('div');
    emptyMsg.className = 'paralelo-empty';
    emptyMsg.textContent = 'Sin paralelos – Agrega uno';
    emptyMsg.style.cssText = 'padding:10px; text-align:center; color:var(--on-surf-var); font-size:12px; font-style:italic;';
    list.appendChild(emptyMsg);
  }

  card.appendChild(list);
  return card;
}

// ═══════════════════════════════════════════════════════════════
//  Contador y render principal
// ═══════════════════════════════════════════════════════════════

function popupUpdateCounter() {
  var total = document.querySelectorAll('.materia-card').length;
  document.getElementById('total-counter').textContent = total + ' mat.';
}

function popupRender(data) {
  PopupState.currentData = data || {};
  var materiasList = document.getElementById('materias-list');
  var emptyState   = document.getElementById('empty-state');

  materiasList.innerHTML = '';

  var allKeys = Object.keys(PopupState.currentData).filter(function(k) {
    return !k.startsWith('_');
  });
  var order   = PopupState.currentData._order || [];
  var matKeys = Array.from(new Set(
    order.filter(function(k) { return allKeys.includes(k); })
         .concat(allKeys.filter(function(k) { return !order.includes(k); }))
  ));

  if (matKeys.length === 0) {
    emptyState.style.display   = 'flex';
    materiasList.style.display = 'none';
  } else {
    emptyState.style.display   = 'none';
    materiasList.style.display = 'block';
    matKeys.forEach(function(nombre) {
      materiasList.appendChild(
        popupBuildMateriaCard(nombre, PopupState.currentData[nombre])
      );
    });
  }

  popupUpdateCounter();
}

// ═══════════════════════════════════════════════════════════════
//  Drag & Drop – módulo compartido
// ═══════════════════════════════════════════════════════════════

function pbInitDragHandle(handleEl, itemEl, containerEl, onDrop) {
  handleEl.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    var indicator = null;
    var targetRef = null;

    function getSiblings() {
      return Array.from(containerEl.children).filter(function(c) {
        return c !== itemEl && !c.classList.contains('drop-indicator');
      });
    }

    function removeIndicator() {
      if (indicator && indicator.parentNode) indicator.parentNode.removeChild(indicator);
      indicator = null;
    }

    function insertIndicatorBefore(ref) {
      removeIndicator();
      indicator = document.createElement('div');
      indicator.className = 'drop-indicator';
      containerEl.insertBefore(indicator, ref || null);
      targetRef = ref;
    }

    itemEl.classList.add('dragging');
    document.body.style.cursor = 'grabbing';

    function onMouseMove(ev) {
      var siblings = getSiblings();
      if (siblings.length === 0) {
        insertIndicatorBefore(null);
        return;
      }

      var insertBefore = null;
      for (var i = 0; i < siblings.length; i++) {
        var rect = siblings[i].getBoundingClientRect();
        var mid  = rect.top + rect.height / 2;
        if (ev.clientY < mid) {
          insertBefore = siblings[i];
          break;
        }
      }
      insertIndicatorBefore(insertBefore);
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      itemEl.classList.remove('dragging');
      document.body.style.cursor = '';

      if (indicator && indicator.parentNode) {
        containerEl.insertBefore(itemEl, indicator.nextSibling);
      }
      removeIndicator();

      if (typeof onDrop === 'function') onDrop();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}