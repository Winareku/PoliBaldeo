/* ============================================================
   Polibaldeo – popup/popup-ui.js
   Renderizado exclusivo del Popup:
     · Tarjetas de materia (buildMateriaCard)
     · Items de paralelo (buildParaleloItem)
     · Función principal render()
   Requiere (cargados antes): utils.js, storage.js, exporter.js
   ============================================================ */

"use strict";

// ── Estado del Popup ─────────────────────────────────────────
var PopupState = {
  currentData     : {},
  isInternalChange: false
};

// ── Utilidad de status bar ───────────────────────────────────

/**
 * Muestra un mensaje temporal en la barra de estado.
 * @param {string} msg
 * @param {string} [type]  'success' | 'warning' | ''
 */
function popupSetStatus(msg, type) {
  var bar = document.getElementById('status-bar');
  bar.textContent = msg;
  bar.className   = type || '';
  setTimeout(function() {
    bar.textContent = '';
    bar.className   = '';
  }, 3000);
}

// ── Persistencia desde la UI ─────────────────────────────────

/**
 * Lee el estado actual del DOM y lo persiste en chrome.storage.local,
 * preservando los datos de horarios/info del estado interno.
 */
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

// ── Construcción de items de paralelo ────────────────────────

/**
 * Crea el elemento DOM de un paralelo.
 * @param {string} nombreMateria
 * @param {string} nParalelo
 * @param {object} data          { horarios, info }
 * @param {HTMLElement} parentList
 * @returns {HTMLElement}
 */
function popupBuildParaleloItem(nombreMateria, nParalelo, data, parentList) {
  var item = document.createElement('div');
  item.className       = 'paralelo-item';
  item.dataset.paralelo = nParalelo;

  var profLine = (data.info || '').split('\n').find(function(l) { return l.includes('Profesor:'); }) || '';
  var prof     = profLine.replace('Profesor:', '').trim() || 'Sin profesor';
  var tagsHtml = (data.horarios || []).map(function(h) {
    return '<span class="horario-tag">' + h + '</span>';
  }).join('');

  item.innerHTML =
    '<div class="paralelo-top">' +
      '<div class="materia-controls">' +
        '<button class="ctrl-btn p-up">▲</button>' +
        '<button class="ctrl-btn p-down">▼</button>' +
      '</div>' +
      '<span class="paralelo-badge">Par. ' + nParalelo + '</span>' +
      '<span class="paralelo-prof">' + prof + '</span>' +
      '<button class="paralelo-delete">✕</button>' +
    '</div>' +
    '<div class="horario-tags">' + tagsHtml + '</div>';

  item.querySelector('.p-up').onclick = function() {
    if (item.previousElementSibling) parentList.insertBefore(item, item.previousElementSibling);
    popupSaveVisualState();
  };
  item.querySelector('.p-down').onclick = function() {
    if (item.nextElementSibling) parentList.insertBefore(item.nextElementSibling, item);
    popupSaveVisualState();
  };
  item.querySelector('.paralelo-delete').onclick = function() {
    item.remove();
    if (parentList.children.length === 0) item.closest('.materia-card').remove();
    popupSaveVisualState();
    popupSetStatus('🗑️ Paralelo eliminado', 'warning');
    popupUpdateCounter();
  };

  return item;
}

// ── Construcción de tarjetas de materia ──────────────────────

/**
 * Crea el elemento DOM de una tarjeta de materia completa.
 * @param {string} nombre
 * @param {object} mat    { creditos, paralelos, _pOrder, collapsed }
 * @returns {HTMLElement}
 */
function popupBuildMateriaCard(nombre, mat) {
  var card = document.createElement('div');
  card.className       = 'materia-card' + (mat.collapsed ? ' collapsed' : '');
  card.dataset.materia = nombre;

  // Cabecera
  var hdr = document.createElement('div');
  hdr.className = 'materia-header';

  // Controles de orden
  var ctrls = document.createElement('div');
  ctrls.className = 'materia-controls';
  ctrls.innerHTML = '<button class="ctrl-btn up">▲</button><button class="ctrl-btn down">▼</button>';
  ctrls.querySelector('.up').onclick = function() {
    if (card.previousElementSibling) card.parentNode.insertBefore(card, card.previousElementSibling);
    popupSaveVisualState();
  };
  ctrls.querySelector('.down').onclick = function() {
    if (card.nextElementSibling) card.parentNode.insertBefore(card.nextElementSibling, card);
    popupSaveVisualState();
  };

  // Nombre (colapso al hacer clic)
  var nameEl = document.createElement('span');
  nameEl.className   = 'materia-name';
  nameEl.textContent = nombre;
  nameEl.onclick     = function() { card.classList.toggle('collapsed'); popupSaveVisualState(); };

  // Stepper de créditos
  var stepper  = document.createElement('div');
  stepper.className = 'creditos-stepper';
  var btnMinus = document.createElement('button');
  btnMinus.textContent = '−';
  var valSpan  = document.createElement('span');
  valSpan.className   = 'creditos-value';
  valSpan.textContent = mat.creditos || '0';
  var btnPlus  = document.createElement('button');
  btnPlus.textContent = '+';
  var updateCredit = function(delta) {
    var v = parseInt(valSpan.textContent, 10) || 0;
    v = Math.max(0, v + delta);
    valSpan.textContent = v;
    popupSaveVisualState();
  };
  btnMinus.onclick = function(e) { e.stopPropagation(); updateCredit(-1); };
  btnPlus.onclick  = function(e) { e.stopPropagation(); updateCredit(+1); };
  stepper.append(btnMinus, valSpan, btnPlus);

  // Botón de colapso
  var collapseBtn = document.createElement('button');
  collapseBtn.className   = 'ctrl-btn';
  collapseBtn.textContent = '▼';
  collapseBtn.onclick = function() { card.classList.toggle('collapsed'); popupSaveVisualState(); };

  hdr.append(ctrls, nameEl, stepper, collapseBtn);
  card.appendChild(hdr);

  // Lista de paralelos
  var list  = document.createElement('div');
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

  card.appendChild(list);
  return card;
}

// ── Contador ─────────────────────────────────────────────────

/** Actualiza el contador de materias en el header. */
function popupUpdateCounter() {
  var total = document.querySelectorAll('.materia-card').length;
  document.getElementById('total-counter').textContent = total + ' mat.';
}

// ── Render principal ─────────────────────────────────────────

/**
 * Re-renderiza completamente la lista de materias.
 * @param {object} data  Objeto polibaldeo_data completo.
 */
function popupRender(data) {
  PopupState.currentData = data || {};
  var materiasList = document.getElementById('materias-list');
  var emptyState   = document.getElementById('empty-state');

  materiasList.innerHTML = '';

  var allKeys = Object.keys(PopupState.currentData).filter(function(k) { return !k.startsWith('_'); });
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
      materiasList.appendChild(popupBuildMateriaCard(nombre, PopupState.currentData[nombre]));
    });
  }

  popupUpdateCounter();
}
