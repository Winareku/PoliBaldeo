/* ============================================================
   Polibaldeo – popup/popup-drag.js
   Sistema de drag & drop para reordenar materias y paralelos.
   ============================================================ */

"use strict";

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
