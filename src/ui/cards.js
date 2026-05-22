/* ============================================================
   Polibaldeo – ui/cards.js
   Construcción y renderizado de tarjetas de materias y paralelos.
   Depende de: state.js, toasts.js, modals.js,
               drag.js, utils.js
   ============================================================ */

"use strict";

// ═══════════════════════════════════════════════════════════════
//  Colapsar / Expandir todo
// ═══════════════════════════════════════════════════════════════

function uiToggleCollapseAll() {
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

  uiSaveVisualState();
}

// ═══════════════════════════════════════════════════════════════
//  Construcción de items de paralelo
// ═══════════════════════════════════════════════════════════════

function uiBuildParaleloItem(nombreMateria, nParalelo, data, parentList) {
  // Obtener el color de la materia
  var colorIdx = uiColorMap[nombreMateria] || 0;
  var c = PB_PALETTE[colorIdx];

  var item = document.createElement('div');
  item.className = 'paralelo-item';
  item.dataset.paralelo = nParalelo;

  // Obtener profesor (desde campos separados o del info antiguo)
  var profTeo = data.profesor || '';
  var profPrac = data.profesorPractico || '';
  // Si no hay profesor en los campos nuevos, intentar obtener del campo 'info' antiguo
  if (!profTeo && !profPrac) {
    var profLine = (data.info || '').split('\n').find(function(l) {
      return l.includes('Profesor:');
    }) || '';
    profTeo = profLine.replace('Profesor:', '').trim() || 'Sin profesor';
    profPrac = '';
  }
  // Construir string final
  var prof = '';
  if (profTeo && profPrac && profTeo !== profPrac) {
    prof = profTeo + ' · ' + profPrac;
  } else {
    prof = profTeo || profPrac || 'Sin profesor';
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
  // Horarios teóricos
  (data.horariosTeoricos || data.horarios || []).forEach(function(h) {
    var tag = document.createElement('span');
    tag.className = 'horario-tag';
    tag.textContent = pbStripSec(h);
    horarioTags.appendChild(tag);
  });
  // Horarios prácticos (si existen)
  if (data.horariosPracticos && data.horariosPracticos.length) {
    data.horariosPracticos.forEach(function(h) {
      var tag = document.createElement('span');
      tag.className = 'horario-tag horario-tag-practico';
      tag.textContent = pbStripSec(h);
      horarioTags.appendChild(tag);
    });
  }

  // Ubicación teórica
  if (data.ubicacionTeorico || data.ubicacion) {
    var ubicPill = document.createElement('span');
    ubicPill.className = 'ubicacion-pill';
    ubicPill.textContent = data.ubicacionTeorico || data.ubicacion;
    item.appendChild(ubicPill);
  }
  // Ubicación práctica (si existe)
  if (data.ubicacionPractico) {
    var ubicPracPill = document.createElement('span');
    ubicPracPill.className = 'ubicacion-pill ubicacion-pill-practico';
    ubicPracPill.textContent = data.ubicacionPractico;
    item.appendChild(ubicPracPill);
  }

  item.appendChild(paraleloTop);
  item.appendChild(horarioTags);

  // Los exámenes NO se muestran en la vista colapsable

  pbInitDragHandle(item.querySelector('.drag-handle'), item, parentList, uiSaveVisualState);

  item.querySelector('.paralelo-edit').onclick = function(e) {
    e.stopPropagation();
    uiOpenEditModal(nombreMateria, nParalelo, false);
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
    uiSaveVisualState();
    uiUpdateCounter();

    pbShowUndoToast('Paralelo ' + nParalelo + ' eliminado', function() {
      var mat = UIState.currentData[nombreMateria];
      if (!mat) return;
      if (!mat.paralelos) mat.paralelos = {};
      mat.paralelos[nParalelo] = savedData;
      if (!mat._pOrder) mat._pOrder = [];
      if (mat._pOrder.indexOf(nParalelo) < 0) {
        mat._pOrder.splice(savedIdx, 0, nParalelo);
      }
      UIState.isInternalChange = true;
      pbSaveData(UIState.currentData, function() {
        UIState.isInternalChange = false;
        uiRender(UIState.currentData);
      });
    });
  };

  return item;
}

// ═══════════════════════════════════════════════════════════════
//  Construcción de tarjetas de materia
// ═══════════════════════════════════════════════════════════════

function uiBuildMateriaCard(nombre, mat) {
  // Asignar color de la paleta si no existe
  if (uiColorMap[nombre] === undefined) {
    uiColorMap[nombre] = (uiColorCtr++) % PB_PALETTE.length;
  }
  var colorIdx = uiColorMap[nombre];
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
  pbInitDragHandle(dragH, card, materiasList, uiSaveVisualState);

  var nameEl         = document.createElement('span');
  nameEl.className   = 'materia-name';
  nameEl.textContent = nombre;
  nameEl.title       = nombre;
  nameEl.style.color = c.fg;
  nameEl.onclick     = function() { uiStartNameEdit(nameEl, card); };

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
    uiSaveVisualState();
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
    uiOpenEditModal(nombre, null, true);
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
    var savedMatData = JSON.parse(JSON.stringify(UIState.currentData[nombre]));
    var savedIdx     = UIState.currentData._order ? UIState.currentData._order.indexOf(nombre) : -1;

    card.remove();
    delete UIState.currentData[nombre];
    var orderIdx = UIState.currentData._order ? UIState.currentData._order.indexOf(nombre) : -1;
    if (orderIdx > -1) UIState.currentData._order.splice(orderIdx, 1);
    uiSaveVisualState();
    uiUpdateCounter();
    if (document.querySelectorAll('.materia-card').length === 0) {
      uiRender(UIState.currentData);
    }

    pbShowUndoToast('"' + nombre + '" eliminada', function() {
      UIState.currentData[nombre] = savedMatData;
      if (!UIState.currentData._order) UIState.currentData._order = [];
      if (savedIdx >= 0 && savedIdx <= UIState.currentData._order.length) {
        UIState.currentData._order.splice(savedIdx, 0, nombre);
      } else {
        UIState.currentData._order.push(nombre);
      }
      UIState.isInternalChange = true;
      pbSaveData(UIState.currentData, function() {
        UIState.isInternalChange = false;
        uiRender(UIState.currentData);
      });
    });
  };

  var collapseBtn         = document.createElement('button');
  collapseBtn.className   = 'ctrl-btn';
  collapseBtn.type        = 'button';
  collapseBtn.textContent = '▼';
  collapseBtn.onclick     = function() {
    card.classList.toggle('collapsed');
    uiSaveVisualState();
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
    list.appendChild(uiBuildParaleloItem(nombre, pNum, mat.paralelos[pNum], list));
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

function uiUpdateCounter() {
  var total = document.querySelectorAll('.materia-card').length;
  document.getElementById('total-counter').textContent = total + ' mat.';
}

function uiRender(data) {
  // Protección contra datos indefinidos
  if (!data) data = {};

  // Restaurar mapa de colores desde los metadatos (compartido con planner)
  if (data._colorMap && typeof data._colorMap === 'object') {
  // Copiar los colores guardados
    uiColorMap = Object.assign({}, data._colorMap);
  // Calcular el próximo índice libre
    var maxIdx = -1;
    Object.keys(uiColorMap).forEach(function(k) {
      if (typeof uiColorMap[k] === 'number' && uiColorMap[k] > maxIdx) {
        maxIdx = uiColorMap[k];
      }
    });
    uiColorCtr = maxIdx + 1;
  } else {
  // Si no hay mapa persistente, empezar fresco
    uiColorMap = {};
    uiColorCtr = 0;
  }

  UIState.currentData = data || {};
  var materiasList = document.getElementById('materias-list');
  var emptyState   = document.getElementById('empty-state');

  materiasList.innerHTML = '';

  var allKeys = Object.keys(UIState.currentData).filter(function(k) {
    return !k.startsWith('_');
  });
  var order   = UIState.currentData._order || [];
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
        uiBuildMateriaCard(nombre, UIState.currentData[nombre])
      );
    });
  }

  uiUpdateCounter();
}
