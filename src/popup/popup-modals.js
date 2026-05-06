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

function pbSectionHeader(title, sectionId, defaultOpen, extraHTML, onOpen) {
  var hdr = document.createElement('div');
  hdr.className = 'pb-section-collapse-hdr';
  hdr.innerHTML = `
    <span class="sym pb-section-chevron">${defaultOpen ? 'expand_less' : 'expand_more'}</span>
    <span class="pb-section-title">${title}</span>
    <span class="pb-header-extra">${extraHTML || ''}</span>
  `;
  hdr.onclick = function(e) {
    if (e.target.tagName === 'INPUT') return; // no colapsar al hacer clic en el input
    var body = document.getElementById(sectionId);
    if (!body) return;
    var isCollapsed = body.classList.contains('collapsed');
    if (isCollapsed) {
      // Abrir esta sección y cerrar las demás mediante el callback
      if (typeof onOpen === 'function') onOpen(sectionId);
    } else {
      // Cerrar esta sección
      body.classList.add('collapsed');
      hdr.querySelector('.pb-section-chevron').textContent = 'expand_more';
    }
  };
  return hdr;
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

  // Migrar campos antiguos si es necesario
  if (!parData.horariosTeoricos && !parData.horariosPracticos) {
    parData.horariosTeoricos = parData.horarios || [];
    parData.horariosPracticos = [];
  }
  if (!parData.ubicacionTeorico && !parData.ubicacionPractico) {
    parData.ubicacionTeorico = parData.ubicacion || "";
    parData.ubicacionPractico = "";
  }

  // Extraer o generar números de paralelo por separado
  var teoPar = '', pracPar = '';
  if (isNew) {
    teoPar = _pbNextParId(materia);  // genera un número nuevo para teórico
    pracPar = '';                     // sin práctico por defecto
  } else {
    var parts = (pId || '').split('-');
    teoPar = parts[0] || '';
    pracPar = parts[1] || '';
  }

  // ── Construir sección Teórico ─────────────────────────────
  var teoricoProf = parData.profesor || '';
  var teoricoUbic = parData.ubicacionTeorico || '';
  // Si no hay datos separados, usar el campo general
  if (!teoricoProf && !teoricoUbic && parData.info) {
    var parsedTeo = pbParseInfo(parData.info);
    teoricoProf = parsedTeo.prof;
    teoricoUbic = parsedTeo.ubic;
  }

  var practicoProf = parData.profesorPractico || '';
  var practicoUbic = parData.ubicacionPractico || '';
  // El práctico no tiene profesor separado en datos antiguos; solo se muestra si hay horarios prácticos

  var horariosTeoRows = '';
  (parData.horariosTeoricos || parData.horarios || []).forEach(function(h) {
    var p = pbParseHorarioStr(h);
    if (p) {
      horariosTeoRows += `
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

  var horariosPracRows = '';
  (parData.horariosPracticos || []).forEach(function(h) {
    var p = pbParseHorarioStr(h);
    if (p) {
      horariosPracRows += `
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

  var examRows = '';
  var examData = parData.examenes || {};
  var labels = { parcial: 'Parcial', final: 'Final', mejoramiento: 'Mejoramiento' };
  Object.keys(labels).forEach(function(key) {
    var ex = examData[key] || {};
    var aulas = ex.aula || '';
    examRows += `
      <div class="pb-section-hdr" style="margin-top:4px;">
        <span>${labels[key]}</span>
      </div>
      <div class="pb-h-row" style="flex-wrap: wrap;">
        <input type="text" class="pb-text-input exam-fecha" id="exam-${key}-fecha" placeholder="YYYY-MM-DD" value="${ex.fecha || ''}" style="max-width:130px;" pattern="\\d{4}-\\d{2}-\\d{2}">
        <input type="text" class="pb-time-input" id="exam-${key}-inicio" placeholder="HH:MM" maxlength="5" value="${ex.inicio || ''}" style="width:65px;">
        <span class="pb-h-sep">–</span>
        <input type="text" class="pb-time-input" id="exam-${key}-fin" placeholder="HH:MM" maxlength="5" value="${ex.fin || ''}" style="width:65px;">
        <div style="width:100%; margin-top:4px;">
          <input type="text" class="pb-text-input" id="exam-${key}-aula" placeholder="Aula" value="${aulas}" style="max-width:100%;">
        </div>
      </div>
    `;
  });

  var bodyHTML = `
    <!-- Sección Teórico (colapsable, abierta por defecto) -->
    <div class="pb-section-container">
      <div id="pb-sect-teorico-hdr"></div>
      <div id="pb-sect-teorico" class="pb-section-body">
        <div class="pb-field-row">
          <span class="pb-field-label">Profesor</span>
          <input id="pb-prof-teo" type="text" class="pb-text-input" placeholder="Profesor teórico" value="${teoricoProf.replace(/"/g, '&quot;')}">
        </div>
        <div class="pb-field-row">
          <span class="pb-field-label">Ubicación</span>
          <input id="pb-ubic-teo" type="text" class="pb-text-input" placeholder="Aula teórica" value="${teoricoUbic.replace(/"/g, '&quot;')}">
        </div>
        <div class="pb-section-hdr">
          <span>Horarios</span>
          <button class="pb-add-btn" id="pb-add-horario-teo" type="button" title="Añadir horario teórico">
            <span class="sym" style="font-size:16px">add</span>
          </button>
        </div>
        <div id="pb-horarios-teo-container" class="pb-horarios-scroll">${horariosTeoRows}</div>
      </div>
    </div>

    <!-- Sección Práctico (colapsable, cerrada por defecto) -->
    <div class="pb-section-container">
      <div id="pb-sect-practico-hdr"></div>
      <div id="pb-sect-practico" class="pb-section-body collapsed">
        <div class="pb-field-row">
          <span class="pb-field-label">Profesor</span>
          <input id="pb-prof-prac" type="text" class="pb-text-input" placeholder="Profesor práctico" value="${practicoProf.replace(/"/g, '&quot;')}">
        </div>
        <div class="pb-field-row">
          <span class="pb-field-label">Ubicación</span>
          <input id="pb-ubic-prac" type="text" class="pb-text-input" placeholder="Aula práctica" value="${practicoUbic.replace(/"/g, '&quot;')}">
        </div>
        <div class="pb-section-hdr">
          <span>Horarios</span>
          <button class="pb-add-btn" id="pb-add-horario-prac" type="button" title="Añadir horario práctico">
            <span class="sym" style="font-size:16px">add</span>
          </button>
        </div>
        <div id="pb-horarios-prac-container" class="pb-horarios-scroll">${horariosPracRows}</div>
      </div>
    </div>

    <!-- Sección Exámenes (colapsable, cerrada por defecto) -->
    <div class="pb-section-container">
      <div id="pb-sect-examenes-hdr"></div>
      <div id="pb-sect-examenes" class="pb-section-body collapsed">
        <div id="pb-examenes-container" class="pb-horarios-scroll" style="display:flex; flex-direction:column; gap:8px;">
          ${examRows}
        </div>
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
    modalBody.style.maxHeight = '620px';
  }

  // Inicializar encabezados colapsables con campos de paralelo
  var teoricoHdr = document.getElementById('pb-sect-teorico-hdr');
  var practicoHdr = document.getElementById('pb-sect-practico-hdr');
  var examHdr = document.getElementById('pb-sect-examenes-hdr');

  // Callback para acordeón: abre una sección y cierra todas las demás
  function soloUnaAbierta(sectionIdToOpen) {
    var bodies = {
      'pb-sect-teorico': document.getElementById('pb-sect-teorico'),
      'pb-sect-practico': document.getElementById('pb-sect-practico'),
      'pb-sect-examenes': document.getElementById('pb-sect-examenes')
    };
    var hdrs = {
      'pb-sect-teorico': document.getElementById('pb-sect-teorico-hdr'),
      'pb-sect-practico': document.getElementById('pb-sect-practico-hdr'),
      'pb-sect-examenes': document.getElementById('pb-sect-examenes-hdr')
    };

    Object.keys(bodies).forEach(function(id) {
      if (id === sectionIdToOpen) {
        bodies[id].classList.remove('collapsed');
        if (hdrs[id]) {
          var chevron = hdrs[id].querySelector('.pb-section-chevron');
          if (chevron) chevron.textContent = 'expand_less';
        }
      } else {
        bodies[id].classList.add('collapsed');
        if (hdrs[id]) {
          var chevron = hdrs[id].querySelector('.pb-section-chevron');
          if (chevron) chevron.textContent = 'expand_more';
        }
      }
    });
  }

  if (teoricoHdr) teoricoHdr.parentNode.replaceChild(
    pbSectionHeader('Teórico', 'pb-sect-teorico', true,
      '<input id="pb-par-teo" type="text" class="pb-text-input" value="' + teoPar + '" style="max-width:70px;">',
      soloUnaAbierta
    ), teoricoHdr);
  if (practicoHdr) practicoHdr.parentNode.replaceChild(
    pbSectionHeader('Práctico', 'pb-sect-practico', false,
      '<input id="pb-par-prac" type="text" class="pb-text-input" value="' + pracPar + '" style="max-width:70px;">',
      soloUnaAbierta
    ), practicoHdr);
  if (examHdr) examHdr.parentNode.replaceChild(
    pbSectionHeader('Exámenes', 'pb-sect-examenes', false, '', soloUnaAbierta), examHdr);

  // Referencias a contenedores
  var containerTeo = modal.getElement('#pb-horarios-teo-container');
  var containerPrac = modal.getElement('#pb-horarios-prac-container');

  // Botón añadir horario teórico
  var addHorarioTeoBtn = modal.getElement('#pb-add-horario-teo');
  if (addHorarioTeoBtn) {
    addHorarioTeoBtn.onclick = function() {
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
      containerTeo.appendChild(row);
    };
  }

  // Botón añadir horario práctico
  var addHorarioPracBtn = modal.getElement('#pb-add-horario-prac');
  if (addHorarioPracBtn) {
    addHorarioPracBtn.onclick = function() {
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
      containerPrac.appendChild(row);
    };
  }

  // Delegación de eventos para eliminar horarios
  var eliminarHorario = function(e) {
    var delBtn = e.target.closest('.pb-h-del');
    if (delBtn) delBtn.closest('.pb-h-row').remove();
  };
  if (containerTeo) containerTeo.addEventListener('click', eliminarHorario);
  if (containerPrac) containerPrac.addEventListener('click', eliminarHorario);

  // Referencias para guardado
  var profTeoInput = modal.getElement('#pb-prof-teo');
  var ubicTeoInput = modal.getElement('#pb-ubic-teo');
  var profPracInput = modal.getElement('#pb-prof-prac');
  var ubicPracInput = modal.getElement('#pb-ubic-prac');

  modal.getElement('#modal-save').onclick = function() {
    var teoPar = modal.getElement('#pb-par-teo')?.value.trim() || '';
    var pracPar = modal.getElement('#pb-par-prac')?.value.trim() || '';
    var newPId = teoPar;
    if (pracPar) newPId += '-' + pracPar;
    if (!newPId) {
      popupSetStatus('⚠️ El paralelo no puede estar vacío', 'warning');
      return;
    }

    var profTeo = profTeoInput ? profTeoInput.value.replace(/\n/g, ' ').trim() : '';
    var ubicTeo = ubicTeoInput ? ubicTeoInput.value.replace(/\n/g, ' ').trim() : '';
    var profPrac = profPracInput ? profPracInput.value.replace(/\n/g, ' ').trim() : '';
    var ubicPrac = ubicPracInput ? ubicPracInput.value.replace(/\n/g, ' ').trim() : '';

    // Leer horarios teóricos
    var horariosTeoricos = [];
    var daySchedules = {};
    var rowsTeo = containerTeo ? containerTeo.querySelectorAll('.pb-h-row') : [];

    for (var i = 0; i < rowsTeo.length; i++) {
      var day = rowsTeo[i].querySelector('.pb-day-sel').value;
      var start = rowsTeo[i].querySelector('.pb-start').value.trim();
      var end = rowsTeo[i].querySelector('.pb-end').value.trim();
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
      horariosTeoricos.push(day + ' ' + start + '-' + end);
    }

    // Leer horarios prácticos (si existen)
    var horariosPracticos = [];
    if (containerPrac) {
      var rowsPrac = containerPrac.querySelectorAll('.pb-h-row');
      for (var k = 0; k < rowsPrac.length; k++) {
        var day = rowsPrac[k].querySelector('.pb-day-sel').value;
        var start = rowsPrac[k].querySelector('.pb-start').value.trim();
        var end = rowsPrac[k].querySelector('.pb-end').value.trim();
        if (!day || !start || !end) continue;

        if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) {
          popupSetStatus('⚠️ Formato de hora inválido en ' + day + ' (usa HH:MM)', 'warning');
          return;
        }

        start = start.padStart(5, '0');
        end = end.padStart(5, '0');

        var sPartsP = start.split(':');
        var ePartsP = end.split(':');
        var sMinsP = parseInt(sPartsP[0], 10) * 60 + parseInt(sPartsP[1], 10);
        var eMinsP = parseInt(ePartsP[0], 10) * 60 + parseInt(ePartsP[1], 10);

        if (eMinsP <= sMinsP) {
          popupSetStatus('⚠️ En el ' + day + ' (práctico), la hora de fin debe ser mayor a la de inicio', 'warning');
          return;
        }

        horariosPracticos.push(day + ' ' + start + '-' + end);
      }
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
      horariosTeoricos: horariosTeoricos,
      horariosPracticos: horariosPracticos,
      profesor: profTeo,
      profesorPractico: profPrac,
      ubicacionTeorico: ubicTeo,
      ubicacionPractico: ubicPrac,
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
