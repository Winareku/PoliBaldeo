/* ============================================================
   Polibaldeo – popup.js  (Orquestador)
   Responsabilidad única: inicializar, cargar datos y enlazar
   listeners de botones.
   
   Depende de:
   - popup-state.js (gestión de estado global)
   - popup-toasts.js (notificaciones tipo toast)
   - popup-modals.js (diálogos modales)
   - popup-cards.js (renderizado de UI)
   - popup-drag.js (drag & drop)
   - shared/utils.js, storage.js, exporter.js, modal.js
   ============================================================ */

(function () {
  "use strict";

  // ── Abrir Planner en ventana emergente ──────────────────────

  document.getElementById('btn-planner').onclick = function () {
    var plannerUrl = chrome.runtime.getURL('planner/planner.html');

    chrome.tabs.query({ url: plannerUrl }, function (tabs) {
      if (tabs && tabs.length > 0) {
        chrome.windows.update(tabs[0].windowId, { focused: true });
        chrome.tabs.update(tabs[0].id, { active: true });
      } else {
        chrome.windows.create({
          url: plannerUrl,
          type: 'popup',
          width: 1000,
          height: 700,
          focused: true
        });
      }
    });
  };

  // ── Colapsar / Expandir todo ──────────────────────────────────

  document.getElementById('btn-collapse-all').onclick = popupToggleCollapseAll;

  // ── Añadir Materia ────────────────────────────────────────────

  document.getElementById('btn-add-materia').onclick = function () {
    popupOpenMateriaModal();
  };

  // ── Importar archivo .poli ────────────────────────────────────

  /**
   * Parsea el contenido del archivo .poli.
   * Primero intenta como JSON (nuevo formato). Si falla, usa el
   * formato de texto antiguo como fallback.
   */
  function parsePoli(text) {
    // Quitar BOM si existe
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    
    // Intentar JSON
    try {
      var data = JSON.parse(text);
      if (data && typeof data === 'object' && Array.isArray(data._order) && data._order.length > 0) {
        // Asegurar estructura básica en cada materia
        data._order.forEach(function(nombre) {
          var mat = data[nombre];
          if (mat && typeof mat === 'object') {
            if (!mat.paralelos) mat.paralelos = {};
            if (!mat._pOrder) mat._pOrder = [];
            if (typeof mat.collapsed !== 'boolean') mat.collapsed = false;
            // Asegurar que cada paralelo tenga la nueva propiedad examenes
            Object.keys(mat.paralelos).forEach(function(pId) {
              var par = mat.paralelos[pId];
              if (!par.examenes) par.examenes = {};
              // Migrar campos antiguos si es necesario
              if (!par.horariosTeoricos && !par.horariosPracticos) {
                par.horariosTeoricos = par.horarios || [];
                par.horariosPracticos = [];
                delete par.horarios;
              }
              if (!par.ubicacionTeorico && !par.ubicacionPractico) {
                par.ubicacionTeorico = par.ubicacion || "";
                par.ubicacionPractico = "";
                delete par.ubicacion;
              }
              if (!par.profesorPractico && par.profesor) {
                par.profesorPractico = '';  // solo inicializar, sin migrar
              }
              if (!par.profesor) {
                // si no hay profesor, buscar en el antiguo campo info
                var infoParsed = pbParseInfo(par.info || '');
                if (infoParsed.prof) par.profesor = infoParsed.prof;
              }
            });
          }
        });
        // Asegurar que el campo _selected exista
        if (!data._selected || typeof data._selected !== 'object') {
          data._selected = {};
        }
        return data;
      }
    } catch(e) { /* no es JSON, probar formato antiguo */ }

    // Fallback: formato de texto antiguo
    return parseOldPoliFormat(text);
  }

  function parseOldPoliFormat(text) {
    var data = { _order: [] };
    data._selected = {};
    var blocks = text.trim().split(/\n[ \t]*\n/);

    blocks.forEach(function (block) {
      var lines = block.trim().split('\n');
      if (!lines.length) return;

      var headerParts = lines[0].split('|');
      var nombre = headerParts[0].trim();
      var creditos = (headerParts[1] || '0').trim();
      if (!nombre) return;

      var mat = { creditos: creditos, paralelos: {}, _pOrder: [], collapsed: false };

      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;

        var parts = line.split(' | ');
        if (parts.length < 2) continue;

        var pId = parts[0].trim();
        var horarios = parts[1].trim().split('; ').filter(Boolean).map(function (h) {
          return h.replace(/(\d{2}:\d{2}):\d{2}/g, '$1');
        });
        var infoRaw = parts.length >= 4 ? parts.slice(3).join(' | ') : '';
        var info = infoRaw.replace(/\\n/g, '\n');

        if (!pId) continue;

        // Extraer profesor y ubicación del campo info
        var prof = '', ubic = '';
        info.split('\n').forEach(function(l) {
          var lt = l.trim();
          if (/^Profesor:/i.test(lt)) prof = lt.replace(/^Profesor:/i, '').trim();
          if (/^Ubicaci[oó]n:/i.test(lt)) ubic = lt.replace(/^Ubicaci[oó]n:/i, '').trim();
        });

        mat.paralelos[pId] = {
          horariosTeoricos: horarios,
          horariosPracticos: [],
          profesor: prof || 'Sin profesor',
          ubicacionTeorico: ubic || '',
          ubicacionPractico: '',
          examenes: {}
        };
        mat._pOrder.push(pId);
      }

      if (mat._pOrder.length > 0) {
        data._order.push(nombre);
        data[nombre] = mat;
      }
    });

    return data;
  }

  document.getElementById('btn-import').onclick = function () {
    var hasData = Object.keys(PopupState.currentData).filter(function (k) {
      return !k.startsWith('_');
    }).length > 0;

    if (hasData) {
      pbConfirm(
        'Ya tienes materias guardadas.\n\n¿Reemplazarlas con las del archivo importado?\n\nSi quieres conservar los datos actuales, cancela y descarga el .poli primero.',
        function () {
          document.getElementById('file-import').click();
        },
        null
      );
    } else {
      document.getElementById('file-import').click();
    }
  };

  document.getElementById('file-import').onchange = function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var imported = parsePoli(ev.target.result);
        var matCount = imported._order.length;
        if (matCount === 0) throw new Error('Sin materias válidas');

        PopupState.isInternalChange = true;
        pbSaveData(imported, function () {
          PopupState.isInternalChange = false;
          popupRender(imported);
          popupSetStatus('✅ ' + matCount + ' materia(s) importadas', 'success');
        });
      } catch (err) {
        popupSetStatus('⚠️ Archivo .poli inválido o vacío', 'warning');
      }
    };
    reader.readAsText(file);
  };

  // ── Exportar ─────────────────────────────────────────────────

  document.getElementById('btn-export').onclick = function () {
    var exported = pbExportPoliFile(PopupState.currentData, null);
    if (!exported) {
      popupSetStatus('⚠️ No hay datos para exportar', 'warning');
    } else {
      popupSetStatus('✅ Exportado', 'success');
    }
  };

  // ── Borrar todo ───────────────────────────────────────────────

  document.getElementById('btn-clear').onclick = function () {
    pbConfirm('¿Borrar todos los datos guardados?', function () {
      pbClearData(function () {
        popupRender({});
      });
    }, null);
  };

  // ── Escuchar cambios externos en storage ─────────────────────

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes[PB_STORAGE_KEY] && !PopupState.isInternalChange) {
      popupRender(changes[PB_STORAGE_KEY].newValue);
    }
  });

  // ── Carga inicial ─────────────────────────────────────────────

  pbLoadData(function (data) {
    popupRender(data);
  });

})();