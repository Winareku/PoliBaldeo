/* ============================================================
   Polibaldeo – popup.js  (Orquestador)
   Responsabilidad única: inicializar, cargar datos y enlazar
   listeners de botones. Toda la lógica de render vive en
   popup-ui.js; la lógica pura en shared/.
   ============================================================ */

(function () {
  "use strict";

  // ── Abrir Planner en ventana emergente ──────────────────────

  document.getElementById('btn-planner').onclick = function () {
    var plannerUrl = chrome.runtime.getURL('planner/planner.html');

    // Buscar si ya existe una tab con la URL del Planner
    chrome.tabs.query({ url: plannerUrl }, function (tabs) {
      if (tabs && tabs.length > 0) {
        // Ya existe: enfocar su ventana y activar su tab
        chrome.windows.update(tabs[0].windowId, { focused: true });
        chrome.tabs.update(tabs[0].id, { active: true });
      } else {
        // No existe: crear ventana nueva
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
   * Parsea el contenido de texto de un archivo .poli y devuelve
   * el objeto de datos compatible con el esquema de polibaldeo_data.
   *
   * Formato:
   *   MATERIA_NAME|creditos
   *   paraleloId | horario1; horario2 | <campo_extra> | info
   *   <línea vacía>
   *   MATERIA_NAME_2|creditos
   *   ...
   */
  function parsePoli(text) {
    if (text.charCodeAt(0) === 0xFEFF) { text = text.slice(1); } // quitar BOM

    var data = { _order: [] };
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
        // Los horarios vienen separados por "; "; eliminar segundos al importar
        var horarios = parts[1].trim().split('; ').filter(Boolean).map(function (h) {
          return h.replace(/(\d{2}:\d{2}):\d{2}/g, '$1');
        });
        // parts[2] es campo auxiliar del exportador — ignorar
        var infoRaw = parts.length >= 4 ? parts.slice(3).join(' | ') : '';
        var info = infoRaw.replace(/\\n/g, '\n');

        if (!pId) continue;
        mat.paralelos[pId] = { horarios: horarios, info: info };
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
    e.target.value = ''; // reset para permitir reimportar el mismo archivo
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
  // (ej: content.js añade un paralelo mientras el popup está abierto)

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
