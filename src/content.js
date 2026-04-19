(function () {
  "use strict";

  function extractData() {
    const materia = document.querySelector("#ctl00_contenido_LabelNombreMateria")?.textContent.trim();
    const teorico = document.querySelector("#ctl00_contenido_LabelParalelo")?.textContent.trim();

    if (!materia || !teorico) return null;

    const hasPracticos = document.querySelectorAll('a.mostrar').length > 0;
    let idCombinado = teorico;
    let infoExtra = "Paralelo Teórico\nProfesor: " + (document.querySelector("#ctl00_contenido_LabelProfesor")?.textContent.trim() || "No asignado");
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
    const rowsTeorico = document.querySelectorAll("#ctl00_contenido_TableHorarios tbody tr");
    rowsTeorico.forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 3) {
        horarios.push(`${cols[0].textContent.trim()} ${cols[1].textContent.trim()}-${cols[2].textContent.trim()}`);
      }
    });

    if (practicoContainer) {
      practicoContainer.querySelectorAll("table tbody tr").forEach(row => {
        const cols = row.querySelectorAll("td");
        if (cols.length >= 3) {
          horarios.push(`${cols[0].textContent.trim()} ${cols[1].textContent.trim()}-${cols[2].textContent.trim()}`);
        }
      });
      infoExtra += "\n\nParalelo Práctico " + idCombinado.split('-')[1] + "\nUbicación: " + (practicoContainer.querySelector("td")?.textContent.trim() || "Ver detalle");
    }

    return {
      materia,
      paraleloId: idCombinado,
      horarios,
      info: infoExtra,
      creditos: "0"
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