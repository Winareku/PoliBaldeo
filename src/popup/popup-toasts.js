/* ============================================================
   Polibaldeo – popup/popup-toasts.js
   Sistema unificado de notificaciones tipo toast.
   ============================================================ */

"use strict";

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
