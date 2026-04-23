(function () {
  "use strict";

  function extractData() {
    const materia = document.querySelector("#ctl00_contenido_LabelNombreMateria")?.textContent.trim();
    const teorico = document.querySelector("#ctl00_contenido_LabelParalelo")?.textContent.trim();

    if (!materia || !teorico) return null;

    const hasPracticos = document.querySelectorAll('a.mostrar').length > 0;
    let idCombinado = teorico;
    
    // 1. Obtener Profesor Principal
    let prof = document.querySelector("#ctl00_contenido_LabelProfesor")?.textContent.trim() || "";
    let ubicacion = "";
    let practicoContainer = null;

    if (hasPracticos) {
      const activeTab = document.querySelector('a.mostrar.active');
      if (!activeTab) {
        showToast("⚠️ Esta materia requiere componente práctico. Selecciónalo primero.", "error");
        return null;
      }
      const numPractico = activeTab.textContent.trim().replace("Práctico ", "");
      idCombinado = `${teorico}-${numPractico}`;
      practicoContainer = document.getElementById("tabla_" + activeTab.id);
    }

    const horarios = [];

    // 2. Extraer horarios y ubicación del Teórico
    const rowsTeorico = document.querySelectorAll("#ctl00_contenido_TableHorarios tbody tr");
    rowsTeorico.forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 3) {
        horarios.push(`${cols[0].textContent.trim()} ${cols[1].textContent.trim()}-${cols[2].textContent.trim()}`);
        
        // La columna 3 es Aula, la 4 es el Bloque/Campus
        if (!ubicacion && cols.length >= 5) {
            ubicacion = `${cols[3].textContent.trim()} ${cols[4].textContent.trim()}`.trim();
        }
      }
    });

    // 3. Extraer horarios, profesor y ubicación del Práctico
    if (practicoContainer) {
      // Buscar si el práctico tiene un profesor distinto (extraerlo sin la palabra "Profesor:")
      const profCell = Array.from(practicoContainer.querySelectorAll("td")).find(td => td.textContent.includes("Profesor:"));
      if (profCell) {
          let profPrac = profCell.textContent.replace("Profesor:", "").replace(/\u00a0/g, " ").trim();
          if (profPrac && profPrac !== prof) {
              // Si es distinto, los unimos con un slash "/"
              prof = prof ? `${prof} / ${profPrac}` : profPrac; 
          }
      }

      // Extraer horarios y ubicación del práctico
      practicoContainer.querySelectorAll("table.display tbody tr").forEach(row => {
        const cols = row.querySelectorAll("td");
        if (cols.length >= 3) {
          horarios.push(`${cols[0].textContent.trim()} ${cols[1].textContent.trim()}-${cols[2].textContent.trim()}`);
          
          if (!ubicacion && cols.length >= 5) {
              ubicacion = `${cols[3].textContent.trim()} ${cols[4].textContent.trim()}`.trim();
          }
        }
      });
    }

    // 4. Construir infoExtra con formato estricto para el Modal de Edición
    let infoExtra = `Profesor: ${prof || "No asignado"}`;
    if (ubicacion) {
        infoExtra += `\nUbicación: ${ubicacion}`;
    }

    return {
      materia,
      paraleloId: idCombinado,
      horarios,
      info: infoExtra,
      creditos: "0" // Los créditos se manejan luego en la UI
    };
  }

  function saveData(entry) {
    chrome.storage.local.get("polibaldeo_data", function (res) {
      const data = res.polibaldeo_data || { _order: [] };

      if (!data[entry.materia]) {
        data[entry.materia] = {
          creditos: entry.creditos,
          paralelos: {},
          _pOrder: [],
          collapsed: false
        };
        if (!data._order.includes(entry.materia)) data._order.push(entry.materia);
      }

      data[entry.materia].paralelos[entry.paraleloId] = {
        horarios: entry.horarios,
        info: entry.info
      };

      if (!data[entry.materia]._pOrder.includes(entry.paraleloId)) {
        data[entry.materia]._pOrder.push(entry.paraleloId);
      }

      chrome.storage.local.set({ polibaldeo_data: data }, function () {
        showToast(`✅ Añadido: ${entry.materia} [P${entry.paraleloId}]`);
      });
    });
  }

  function showToast(msg, type = "info") {
    let toast = document.getElementById("polibaldeo-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "polibaldeo-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = "show " + type;

    clearTimeout(window.pbToastTimer);
    window.pbToastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function injectButton() {
    if (document.getElementById("polibaldeo-btn-wrap")) return;
    const target = document.querySelector("#ctl00_contenido_LabelNombreMateria");
    if (!target) return;

    const wrap = document.createElement("span");
    wrap.id = "polibaldeo-btn-wrap";
    wrap.innerHTML = `<button id="polibaldeo-add-btn" type="button">📌 Añadir a Polibaldeo</button>`;

    wrap.querySelector("button").onclick = () => {
      const data = extractData();
      if (data) saveData(data);
    };

    target.parentNode.appendChild(wrap);
  }

  injectButton();
  new MutationObserver(injectButton).observe(document.body, { childList: true, subtree: true });

})();