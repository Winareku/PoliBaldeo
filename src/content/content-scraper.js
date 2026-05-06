// ── Helpers ────────────────────────────────────────────────
function parseExamInfo(text, aulaText) {
  if (!text) return null;
  var match = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2}:\d{2})\s*a\s*(\d{2}:\d{2})/);
  if (!match) return null;
  return {
    fecha: match[3] + '-' + match[2] + '-' + match[1],
    inicio: match[4],
    fin: match[5],
    aula: aulaText ? aulaText.trim() : ''
  };
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

// ── Extracción de datos ───────────────────────────────────
function _extractDataFromDoc(doc) {
  // Similar a _extractData pero usando el documento proporcionado
  const materia = doc.querySelector("#ctl00_contenido_LabelNombreMateria")?.textContent.trim();
  const teorico = doc.querySelector("#ctl00_contenido_LabelParalelo")?.textContent.trim();
  if (!materia || !teorico) return null;

  const hasPracticos = doc.querySelectorAll('a.mostrar').length > 0;
  let idCombinado = teorico;
  let profesorPrincipal = doc.querySelector("#ctl00_contenido_LabelProfesor")?.textContent.trim() || "";
  let ubicacionTeorico = "";
  let ubicacionPractico = "";
  let profesorPractico = "";
  let practicoContainer = null;

  // Práctico activo (suponemos que al cargar la página viene con el práctico activo si lo hay)
  const activeTab = doc.querySelector('a.mostrar.active');
  if (activeTab) {
    const numPractico = activeTab.textContent.trim().replace("Práctico ", "");
    idCombinado = teorico + '-' + numPractico;
    practicoContainer = doc.getElementById("tabla_" + activeTab.id);
  }

  const horariosTeoricos = [];
  const rowsTeorico = doc.querySelectorAll("#ctl00_contenido_TableHorarios tbody tr");
  rowsTeorico.forEach(row => {
    const cols = row.querySelectorAll("td");
    if (cols.length >= 3) {
      horariosTeoricos.push(`${cols[0].textContent.trim()} ${cols[1].textContent.trim()}-${cols[2].textContent.trim()}`);
      if (!ubicacionTeorico && cols.length >= 5) {
        ubicacionTeorico = `${cols[3].textContent.trim()} ${cols[4].textContent.trim()}`.trim();
      }
    }
  });

  const horariosPracticos = [];
  if (practicoContainer) {
    const profCell = Array.from(practicoContainer.querySelectorAll("td")).find(td => td.textContent.includes("Profesor:"));
    if (profCell) {
      let profPrac = profCell.textContent.replace("Profesor:", "").replace(/\u00a0/g, " ").trim();
      if (profPrac && profPrac !== profesorPrincipal) {
        profesorPractico = profPrac;
      }
    }
    practicoContainer.querySelectorAll("table.display tbody tr").forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 3) {
        horariosPracticos.push(`${cols[0].textContent.trim()} ${cols[1].textContent.trim()}-${cols[2].textContent.trim()}`);
        if (!ubicacionPractico && cols.length >= 5) {
          ubicacionPractico = `${cols[3].textContent.trim()} ${cols[4].textContent.trim()}`.trim();
        }
      }
    });
  }

  // Exámenes
  var examenes = {};
  var parcialText = doc.querySelector("#ctl00_contenido_LabelParcial")?.textContent.trim();
  var finalText   = doc.querySelector("#ctl00_contenido_LabelFinal")?.textContent.trim();
  var mejoraText  = doc.querySelector("#ctl00_contenido_LabelMejora")?.textContent.trim();
  var aulaParcial = doc.querySelector("#ctl00_contenido_aulaParcial")?.textContent.trim() || '';
  var aulaFinal   = doc.querySelector("#ctl00_contenido_aulaFinal")?.textContent.trim() || '';
  var aulaMejora  = doc.querySelector("#ctl00_contenido_aulaMej")?.textContent.trim() || '';

  var parcialInfo = parseExamInfo(parcialText, aulaParcial);
  if (parcialInfo) examenes.parcial = parcialInfo;
  var finalInfo = parseExamInfo(finalText, aulaFinal);
  if (finalInfo) examenes.final = finalInfo;
  var mejoraInfo = parseExamInfo(mejoraText, aulaMejora);
  if (mejoraInfo) examenes.mejoramiento = mejoraInfo;

  return {
    materia,
    paraleloId: idCombinado,
    horariosTeoricos,
    horariosPracticos,
    ubicacionTeorico,
    ubicacionPractico,
    profesor: profesorPrincipal || "No asignado",
    profesorPractico,
    creditos: "0",
    examenes
  };
}

function _extractData() {
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
    if (!activeTab) return null;
    let numPractico = activeTab.textContent.trim();
    // Si el texto contiene "Práctico", lo limpiamos; si no, lo dejamos igual
    if (numPractico.includes("Práctico")) numPractico = numPractico.replace("Práctico ", "");
    idCombinado = `${teorico}-${numPractico}`;
    practicoContainer = document.getElementById("tabla_" + activeTab.id);
  }

  var horariosTeoricos = [];
  var horariosPracticos = [];
  var ubicacionTeorico = "";
  var ubicacionPractico = "";

  // Teórico
  var rowsTeorico = document.querySelectorAll("#ctl00_contenido_TableHorarios tbody tr");
  rowsTeorico.forEach(row => {
    var cols = row.querySelectorAll("td");
    if (cols.length >= 3) {
      horariosTeoricos.push(`${cols[0].textContent.trim()} ${cols[1].textContent.trim()}-${cols[2].textContent.trim()}`);
      if (!ubicacionTeorico && cols.length >= 5) {
        ubicacionTeorico = `${cols[3].textContent.trim()} ${cols[4].textContent.trim()}`.trim();
      }
    }
  });

  // Práctico
  if (practicoContainer) {
    var profesorPractico = "";
    var profCell = Array.from(practicoContainer.querySelectorAll("td")).find(td => td.textContent.includes("Profesor:"));
    if (profCell) {
      let profPrac = profCell.textContent.replace("Profesor:", "").replace(/\u00a0/g, " ").trim();
      if (profPrac && profPrac !== profesorPrincipal) {
        profesorPractico = profPrac;
      } else {
        profesorPractico = ""; // es el mismo profesor, no hace falta duplicar
      }
    }
    practicoContainer.querySelectorAll("table.display tbody tr").forEach(row => {
      var cols = row.querySelectorAll("td");
      if (cols.length >= 3) {
        horariosPracticos.push(`${cols[0].textContent.trim()} ${cols[1].textContent.trim()}-${cols[2].textContent.trim()}`);
        if (!ubicacionPractico && cols.length >= 5) {
          ubicacionPractico = `${cols[3].textContent.trim()} ${cols[4].textContent.trim()}`.trim();
        }
      }
    });
  }

  var examenes = {};
  var parcialText = document.querySelector("#ctl00_contenido_LabelParcial")?.textContent.trim();
  var finalText   = document.querySelector("#ctl00_contenido_LabelFinal")?.textContent.trim();
  var mejoraText  = document.querySelector("#ctl00_contenido_LabelMejora")?.textContent.trim();
  var aulaParcial = document.querySelector("#ctl00_contenido_aulaParcial")?.textContent.trim() || '';
  var aulaFinal   = document.querySelector("#ctl00_contenido_aulaFinal")?.textContent.trim() || '';
  var aulaMejora  = document.querySelector("#ctl00_contenido_aulaMej")?.textContent.trim() || '';

  var parcialInfo = parseExamInfo(parcialText, aulaParcial);
  if (parcialInfo) examenes.parcial = parcialInfo;
  var finalInfo = parseExamInfo(finalText, aulaFinal);
  if (finalInfo) examenes.final = finalInfo;
  var mejoraInfo = parseExamInfo(mejoraText, aulaMejora);
  if (mejoraInfo) examenes.mejoramiento = mejoraInfo;

  return {
    materia,
    paraleloId: idCombinado,
    horariosTeoricos: horariosTeoricos,
    horariosPracticos: horariosPracticos,
    ubicacionTeorico: ubicacionTeorico,
    ubicacionPractico: ubicacionPractico,
    profesor: profesorPrincipal || "No asignado",
    profesorPractico: profesorPractico,   // ← nueva línea
    creditos: "0",
    examenes: examenes
  };
}

/**
 * Verifica si un paralelo (materia + paraleloId) ya está guardado.
 * @param {string} materia
 * @param {string} paraleloId
 * @param {function(boolean)} callback
 */
function checkParaleloExists(materia, paraleloId, callback) {
  chrome.storage.local.get("polibaldeo_data", function(res) {
    var data = res.polibaldeo_data || {};
    var exists = !!(data[materia] && data[materia].paralelos[paraleloId]);
    callback(exists);
  });
}

function saveData(entry) {
  if (!chrome || !chrome.storage || !chrome.storage.local) {
    console.error("chrome.storage no disponible en este momento");
    showToast("⚠️ Error: No se pudo guardar porque la página se recargó", "error");
    return;
  }
  chrome.storage.local.get("polibaldeo_data", function (res) {
    const data = res.polibaldeo_data || { _order: [] };
    // Determinar si el paralelo ya existía
    var existed = data[entry.materia] && data[entry.materia].paralelos[entry.paraleloId];

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
      horariosTeoricos: entry.horariosTeoricos || [],
      horariosPracticos: entry.horariosPracticos || [],
      ubicacionTeorico: entry.ubicacionTeorico || "",
      ubicacionPractico: entry.ubicacionPractico || "",
      profesor: entry.profesor,
      profesorPractico: entry.profesorPractico || "",   // ← nueva línea
      examenes: entry.examenes || {}
    };
    if (!data[entry.materia]._pOrder.includes(entry.paraleloId)) {
      data[entry.materia]._pOrder.push(entry.paraleloId);
    }
    chrome.storage.local.set({ polibaldeo_data: data }, function () {
      showToast(
        existed
          ? `✅ Actualizado: ${entry.materia} [P${entry.paraleloId}]`
          : `✅ Añadido: ${entry.materia} [P${entry.paraleloId}]`
      );
      // Actualizar el botón para reflejar el nuevo estado
      updateButtonState();
    });
  });
}

function captureData() {
  var data = _extractData();
  if (data) {
    saveData(data);
    return;
  }
  var practicoTabs = document.querySelectorAll('a.mostrar');
  if (practicoTabs.length === 1 && !document.querySelector('a.mostrar.active')) {
    practicoTabs[0].click();
    setTimeout(() => {
      var data2 = _extractData();
      if (data2) saveData(data2);
      else showToast("⚠️ No se pudo obtener los datos del práctico.", "error");
    }, 400);
  } else {
    showToast("⚠️ Esta materia requiere componente práctico. Selecciónalo primero.", "error");
  }
}