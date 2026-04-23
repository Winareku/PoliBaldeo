(function () {
  "use strict";

  function parseExamInfo(text) {
    if (!text) return null;
    var match = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2}:\d{2})\s*a\s*(\d{2}:\d{2})/);
    if (!match) return null;
    return {
      fecha: match[3] + '-' + match[2] + '-' + match[1],
      inicio: match[4],
      fin: match[5]
    };
  }

  function extractData() {
    const materia = document.querySelector("#ctl00_contenido_LabelNombreMateria")?.textContent.trim();
    const teorico = document.querySelector("#ctl00_contenido_LabelParalelo")?.textContent.trim();

    if (!materia || !teorico) return null;

    const hasPracticos = document.querySelectorAll('a.mostrar').length > 0;
    let idCombinado = teorico;

    let profesorPrincipal = document.querySelector("#ctl00_contenido_LabelProfesor")?.textContent.trim() || "";
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

    // Teórico
    const rowsTeorico = document.querySelectorAll("#ctl00_contenido_TableHorarios tbody tr");
    rowsTeorico.forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 3) {
        horarios.push(`${cols[0].textContent.trim()} ${cols[1].textContent.trim()}-${cols[2].textContent.trim()}`);
        if (!ubicacion && cols.length >= 5) {
          ubicacion = `${cols[3].textContent.trim()} ${cols[4].textContent.trim()}`.trim();
        }
      }
    });

    // Práctico
    if (practicoContainer) {
      const profCell = Array.from(practicoContainer.querySelectorAll("td")).find(td => td.textContent.includes("Profesor:"));
      if (profCell) {
        let profPrac = profCell.textContent.replace("Profesor:", "").replace(/\u00a0/g, " ").trim();
        if (profPrac && profPrac !== profesorPrincipal) {
          profesorPrincipal = profesorPrincipal ? `${profesorPrincipal} / ${profPrac}` : profPrac;
        }
      }

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

    // Exámenes
    var examenes = {};
    var parcialText = document.querySelector("#ctl00_contenido_LabelParcial")?.textContent.trim();
    var finalText   = document.querySelector("#ctl00_contenido_LabelFinal")?.textContent.trim();
    var mejoraText  = document.querySelector("#ctl00_contenido_LabelMejora")?.textContent.trim();

    var parcialInfo = parseExamInfo(parcialText);
    if (parcialInfo) examenes.parcial = parcialInfo;

    var finalInfo = parseExamInfo(finalText);
    if (finalInfo) examenes.final = finalInfo;

    var mejoraInfo = parseExamInfo(mejoraText);
    if (mejoraInfo) examenes.mejoramiento = mejoraInfo;

    return {
      materia,
      paraleloId: idCombinado,
      horarios,
      profesor: profesorPrincipal || "No asignado",
      ubicacion: ubicacion,
      creditos: "0",
      examenes: examenes
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
        profesor: entry.profesor,
        ubicacion: entry.ubicacion,
        examenes: entry.examenes || {}
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