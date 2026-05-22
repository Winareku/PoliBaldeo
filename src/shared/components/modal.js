/* ============================================================
   Polibaldeo – shared/components/modal.js
   Componente reutilizable para crear modales dinámicos.
   ============================================================ */

"use strict";

window.PBModal = (function() {

  /**
   * Crea un modal y lo inyecta en el body.
   * @param {Object} options
   * @param {string} options.title      - Título del modal
   * @param {string} options.body       - Contenido HTML del cuerpo
   * @param {string} options.footer     - Contenido HTML del pie (botones)
   * @returns {Object} API del modal
   */
  function create(options) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    var card = document.createElement('div');
    card.className = 'modal-card';

  // Header
    var header = document.createElement('div');
    header.className = 'modal-header';
    var h2 = document.createElement('h2');
    h2.textContent = options.title || 'Modal';
    header.appendChild(h2);

  // Body – accepts controlled HTML templates written in our own codebase, never user input
    var body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML = options.body || ''; // safe: static HTML from callers

  // Footer – accepts controlled HTML templates written in our own codebase, never user input
    var footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = options.footer || ''; // safe: static HTML from callers

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

  // Cerrar al hacer clic fuera del card
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.classList.remove('visible');
      }
    });

    return {
      open: function() {
        overlay.classList.add('visible');
      },
      close: function() {
        overlay.classList.remove('visible');
      },
      destroy: function() {
        overlay.remove();
      },
      getElement: function(selector) {
        return overlay.querySelector(selector);
      },
      root: overlay
    };
  }

  return { create: create };

})();