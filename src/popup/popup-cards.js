/* ============================================================
   Polibaldeo – popup/popup-cards.js
   Construcción y renderizado de tarjetas de materias y paralelos.
   Depende de: popup-state.js, popup-toasts.js, popup-modals.js,
               popup-drag.js, utils.js
   ============================================================ */

"use strict";

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
//  Construcción de items de paralelo
// ═══════════════════════════════════════════════════════════════

function popupBuildParaleloItem(nombreMateria, nParalelo, data, parentList) {
  // Obtener el color de la materia
  var colorIdx = popupColorMap[nombreMateria] || 0;
  var c = PB_PALETTE[colorIdx];

  var item = document.createElement('div');
  item.className = 'paralelo-item';
  item.dataset.paralelo = nParalelo;

  // Obtener profesor (desde campo separado o del info antiguo)
  var prof = data.profesor || '';
  if (!prof) {
    var profLine = (data.info || '').split('\n').find(function(l) {
      return l.includes('Profesor:');
    }) || '';
    prof = profLine.replace('Profesor:', '').trim() || 'Sin profesor';
  }
  if (!prof) prof = 'Sin profesor';

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
  paraleloBadge.style.backgroundColor = c.ac + '1a';
  paraleloBadge.style.color = c.fg;
  paraleloBadge.style.border = '1px solid ' + c.ac + '40';

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

  // Ubicación como píldora sin emoji
  if (data.ubicacion) {
    var ubicPill = document.createElement('span');
    ubicPill.className = 'ubicacion-pill';
    ubicPill.textContent = data.ubicacion;
    item.appendChild(ubicPill);
  }

  item.appendChild(paraleloTop);
  item.appendChild(horarioTags);

  // Los exámenes NO se muestran en la vista colapsable

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
  // Asignar color de la paleta si no existe
  if (popupColorMap[nombre] === undefined) {
    popupColorMap[nombre] = (popupColorCtr++) % PB_PALETTE.length;
  }
  var colorIdx = popupColorMap[nombre];
  var c = PB_PALETTE[colorIdx];

  var card             = document.createElement('div');
  card.className       = 'materia-card' + (mat.collapsed ? ' collapsed' : '');
  card.dataset.materia = nombre;
  card.style.setProperty('--mat-ac', c.ac);

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
  nameEl.style.color = c.fg;
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
  // Restaurar mapa de colores desde los metadatos (compartido con planner)
  if (data._colorMap && typeof data._colorMap === 'object') {
    // Copiar los colores guardados
    popupColorMap = Object.assign({}, data._colorMap);
    // Calcular el próximo índice libre
    var maxIdx = -1;
    Object.keys(popupColorMap).forEach(function(k) {
      if (typeof popupColorMap[k] === 'number' && popupColorMap[k] > maxIdx) {
        maxIdx = popupColorMap[k];
      }
    });
    popupColorCtr = maxIdx + 1;
  } else {
    // Si no hay mapa persistente, empezar fresco
    popupColorMap = {};
    popupColorCtr = 0;
  }

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
