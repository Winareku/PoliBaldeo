// ── Split Button Polibaldeo ────────────────────────────────
function injectButton() {
  if (document.getElementById("polibaldeo-btn-wrap")) return;

  const nav = document.getElementById("polibaldeo-nav");
  let insertAfter = nav;
  if (!insertAfter) {
    insertAfter = document.querySelector("#container h1:nth-of-type(2)");
    if (!insertAfter) return;
  }

  // Contenedor principal
  const wrap = document.createElement("div");
  wrap.id = "polibaldeo-btn-wrap";
  wrap.style.cssText = "display: flex; justify-content: center; margin: 16px 0;";

  // Contenedor relativo para el split button
  const splitContainer = document.createElement("div");
  splitContainer.className = "polibaldeo-split-container";

  // Botón principal
  const mainBtn = document.createElement("button");
  mainBtn.id = "polibaldeo-add-btn";
  mainBtn.type = "button";
  mainBtn.className = "polibaldeo-btn-main";
  mainBtn.onclick = function(e) {
    e.stopPropagation();
    // Cerrar dropdown si está abierto
    closeDropdown();
    captureData();
  };

  // Botón flecha
  const arrowBtn = document.createElement("button");
  arrowBtn.id = "polibaldeo-arrow-btn";
  arrowBtn.type = "button";
  arrowBtn.className = "polibaldeo-btn-arrow";
  arrowBtn.innerHTML = '<span class="polibaldeo-arrow-icon">▾</span>';
  arrowBtn.title = "Más opciones";
  arrowBtn.onclick = function(e) {
    e.stopPropagation();
    toggleDropdown();
  };

  // Dropdown
  const dropdown = document.createElement("div");
  dropdown.id = "polibaldeo-dropdown";
  dropdown.className = "polibaldeo-dropdown";

  // Opción del dropdown
  const addAllOption = document.createElement("button");
  addAllOption.className = "polibaldeo-dropdown-item";
  addAllOption.textContent = "Añadir todas las combinaciones";
  addAllOption.onclick = function(e) {
    e.stopPropagation();
    closeDropdown();
    addAllPracticos();
  };

  dropdown.appendChild(addAllOption);
  splitContainer.appendChild(mainBtn);
  splitContainer.appendChild(arrowBtn);
  splitContainer.appendChild(dropdown);
  wrap.appendChild(splitContainer);
  insertAfter.insertAdjacentElement("afterend", wrap);

  // Cerrar dropdown al hacer clic fuera
  document.addEventListener('click', function(e) {
    if (!splitContainer.contains(e.target)) {
      closeDropdown();
    }
  });

  function toggleDropdown() {
    const isOpen = dropdown.classList.contains('polibaldeo-dropdown-open');
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  function openDropdown() {
    const practicoTabs = document.querySelectorAll('a.mostrar');
    const count = practicoTabs.length || 1; // Si no hay prácticos, al menos se añade el teórico solo
    addAllOption.textContent = `Añadir todo (${count})`;
    dropdown.classList.add('polibaldeo-dropdown-open');
  }

  function closeDropdown() {
    dropdown.classList.remove('polibaldeo-dropdown-open');
  }

  updateButtonState();
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('mostrar')) {
      setTimeout(updateButtonState, 100);
    }
  });
}

// Funciones auxiliares (colócalas antes de addAllPracticos)
// ========== FUNCIONES AUXILIARES ==========

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractHorariosTeoricos() {
  const horarios = [];
  const rows = document.querySelectorAll("#ctl00_contenido_TableHorarios tbody tr");
  rows.forEach(row => {
    const cols = row.querySelectorAll("td");
    if (cols.length >= 3) {
      horarios.push(`${cols[0].textContent.trim()} ${cols[1].textContent.trim()}-${cols[2].textContent.trim()}`);
    }
  });
  return horarios;
}

function extractUbicacionTeorico() {
  let ubicacion = "";
  const rows = document.querySelectorAll("#ctl00_contenido_TableHorarios tbody tr");
  rows.forEach(row => {
    const cols = row.querySelectorAll("td");
    if (!ubicacion && cols.length >= 5) {
      ubicacion = `${cols[3].textContent.trim()} ${cols[4].textContent.trim()}`.trim();
    }
  });
  return ubicacion;
}

function extractExamenes() {
  const examenes = {};
  const parcialText = document.querySelector("#ctl00_contenido_LabelParcial")?.textContent.trim();
  const finalText   = document.querySelector("#ctl00_contenido_LabelFinal")?.textContent.trim();
  const mejoraText  = document.querySelector("#ctl00_contenido_LabelMejora")?.textContent.trim();
  const aulaParcial = document.querySelector("#ctl00_contenido_aulaParcial")?.textContent.trim() || '';
  const aulaFinal   = document.querySelector("#ctl00_contenido_aulaFinal")?.textContent.trim() || '';
  const aulaMejora  = document.querySelector("#ctl00_contenido_aulaMej")?.textContent.trim() || '';

  if (window.parseExamInfo) {
    const parcialInfo = parseExamInfo(parcialText, aulaParcial);
    if (parcialInfo) examenes.parcial = parcialInfo;
    const finalInfo = parseExamInfo(finalText, aulaFinal);
    if (finalInfo) examenes.final = finalInfo;
    const mejoraInfo = parseExamInfo(mejoraText, aulaMejora);
    if (mejoraInfo) examenes.mejoramiento = mejoraInfo;
  }
  return examenes;
}

function extractPracticoDataFromContainer(container) {
  let profesor = "";
  const profCell = Array.from(container.querySelectorAll("td")).find(td => td.textContent.includes("Profesor:"));
  if (profCell) {
    profesor = profCell.textContent.replace("Profesor:", "").replace(/\u00a0/g, " ").trim();
  }

  const horarios = [];
  let ubicacion = "";
  const tablas = container.querySelectorAll("table.display");
  tablas.forEach(tabla => {
    const rows = tabla.querySelectorAll("tbody tr");
    rows.forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 3) {
        const dia = cols[0].textContent.trim();
        const inicio = cols[1].textContent.trim();
        const fin = cols[2].textContent.trim();
        horarios.push(`${dia} ${inicio}-${fin}`);
        if (!ubicacion && cols.length >= 5) {
          ubicacion = `${cols[3].textContent.trim()} ${cols[4].textContent.trim()}`.trim();
        }
      }
    });
  });
  return { profesor, horarios, ubicacion };
}

// ========== FUNCIÓN PRINCIPAL ==========
async function addAllPracticos() {
  const mainBtn = document.getElementById("polibaldeo-add-btn");
  const arrowBtn = document.getElementById("polibaldeo-arrow-btn");
  if (mainBtn) mainBtn.disabled = true;
  if (arrowBtn) arrowBtn.disabled = true;

  // Pequeño retardo para asegurar que el deshabilitado se aplique
  setTimeout(() => {
    try {
      const materia = document.querySelector("#ctl00_contenido_LabelNombreMateria")?.textContent.trim();
      const teorico = document.querySelector("#ctl00_contenido_LabelParalelo")?.textContent.trim();
      if (!materia || !teorico) {
        showToast("⚠️ No se pudo identificar la materia o paralelo teórico", "error");
        enableButtons();
        return;
      }

      const practicoTabs = document.querySelectorAll('a.mostrar');
      const total = practicoTabs.length;
      
      if (total === 0) {
        const data = _extractData();
        if (data) saveData(data);
        enableButtons();
        return;
      }

      // Recolectar datos de todos los prácticos (sin guardar aún)
      const entries = [];
      for (let i = 0; i < total; i++) {
        const tab = practicoTabs[i];
        const numPractico = tab.textContent.trim();
        const containerId = `tabla_${tab.id}`;
        const container = document.getElementById(containerId);
        if (!container) continue;

        const practicoData = extractPracticoDataFromContainer(container);
        if (!practicoData) continue;

        entries.push({
          paraleloId: `${teorico}-${numPractico}`,
          horariosPracticos: practicoData.horarios,
          ubicacionPractico: practicoData.ubicacion,
          profesorPractico: practicoData.profesor
        });
      }

      if (entries.length === 0) {
        showToast("⚠️ No se encontraron datos de prácticos", "warning");
        enableButtons();
        return;
      }

      // Datos comunes de la materia (teórico) - se extraen una sola vez
      const horariosTeoricos = extractHorariosTeoricos();
      const ubicacionTeorico = extractUbicacionTeorico();
      const profesorPrincipal = document.querySelector("#ctl00_contenido_LabelProfesor")?.textContent.trim() || "No asignado";
      const examenes = extractExamenes();

      // Guardar todo en una sola operación
      chrome.storage.local.get("polibaldeo_data", function(res) {
        const data = res.polibaldeo_data || { _order: [] };
        
        if (!data[materia]) {
          data[materia] = {
            creditos: "0",
            paralelos: {},
            _pOrder: [],
            collapsed: false
          };
          if (!data._order.includes(materia)) data._order.push(materia);
        }

        entries.forEach(entry => {
          data[materia].paralelos[entry.paraleloId] = {
            horariosTeoricos: horariosTeoricos,
            horariosPracticos: entry.horariosPracticos,
            ubicacionTeorico: ubicacionTeorico,
            ubicacionPractico: entry.ubicacionPractico,
            profesor: profesorPrincipal,
            profesorPractico: entry.profesorPractico || "",
            examenes: examenes
          };
          if (!data[materia]._pOrder.includes(entry.paraleloId)) {
            data[materia]._pOrder.push(entry.paraleloId);
          }
        });

        chrome.storage.local.set({ polibaldeo_data: data }, function() {
          showToast(`✅ ${entries.length} combinaciones guardadas`, "success");
          enableButtons();
          updateButtonState();
        });
      });
    } catch (err) {
      console.error("Error en addAllPracticos:", err);
      showToast("❌ Ocurrió un error", "error");
      enableButtons();
    }
  }, 50);

  function enableButtons() {
    if (mainBtn) mainBtn.disabled = false;
    if (arrowBtn) arrowBtn.disabled = false;
  }
}


/**
 * Actualiza el texto, color y habilitación del botón según el estado actual.
 */
function updateButtonState() {
  var btn = document.getElementById("polibaldeo-add-btn");
  if (!btn) return;

  var materia = document.querySelector("#ctl00_contenido_LabelNombreMateria")?.textContent.trim();
  if (!materia) {
    btn.disabled = true;
    btn.textContent = '📌 Añadir a PoliBaldeo';
    btn.classList.remove('polibaldeo-btn-update');
    btn.classList.add('polibaldeo-btn-main');
    return;
  }

  var teorico = document.querySelector("#ctl00_contenido_LabelParalelo")?.textContent.trim() || '';
  var practicos = document.querySelectorAll('a.mostrar');
  var activeTab = document.querySelector('a.mostrar.active');

  // Caso 1: sin prácticos o con varios pero ninguno activo → botón solo para añadir (estilo neutro)
  if (practicos.length === 0 || (!activeTab && practicos.length > 1)) {
    btn.disabled = false;
    btn.textContent = '📌 Añadir a PoliBaldeo';
    btn.classList.remove('polibaldeo-btn-update');
    btn.classList.add('polibaldeo-btn-main');
    return;
  }

  // Caso 2: hay un práctico activo o un único práctico sin activar
  var idCombinado = teorico;
  if (activeTab) {
    var numPractico = activeTab.textContent.trim().replace("Práctico ", "");
    idCombinado = teorico + '-' + numPractico;
  } else if (practicos.length === 1 && !activeTab) {
    var unicoPractico = practicos[0].textContent.trim().replace("Práctico ", "");
    idCombinado = teorico + '-' + unicoPractico;
  }

  checkParaleloExists(materia, idCombinado, function(exists) {
    btn.disabled = false;
    if (exists) {
      btn.textContent = '✅ Actualizar en PoliBaldeo';
      btn.classList.remove('polibaldeo-btn-main');
      btn.classList.add('polibaldeo-btn-update');
    } else {
      btn.textContent = '📌 Añadir a PoliBaldeo';
      btn.classList.remove('polibaldeo-btn-update');
      btn.classList.add('polibaldeo-btn-main');
    }
  });
}

// ── Navegador de paralelos Material 3 ─────────────────────
function injectParaleloNavigator() {
  if (document.getElementById("polibaldeo-nav")) return;
  const labelSpan = document.getElementById("ctl00_contenido_LabelParalelos");
  if (!labelSpan) return;

  const currentNum = document.querySelector("#ctl00_contenido_LabelParalelo")?.textContent.trim();
  if (!currentNum) return;

  // Extraer todos los enlaces del span
  const linkElements = labelSpan.querySelectorAll('a');
  const linkedNums = new Map(); // num -> href
  linkElements.forEach(a => {
    const n = a.textContent.trim();
    if (/^\d+$/.test(n)) linkedNums.set(n, a.href);
  });

  // Obtener el texto completo del span y extraer todos los números
  const fullText = labelSpan.textContent; // p.ej. "[ 1 2 3 ]"
  const numMatches = fullText.match(/\d+/g) || [];
  const allNumbers = numMatches.map(Number).sort((a,b)=>a-b).map(String);

  // Cada número es un paralelo. Si está en linkedNums, tiene href; si no, es el actual.
  const links = allNumbers.map(num => ({
    num: num,
    href: linkedNums.has(num) ? linkedNums.get(num) : null,
  }));

  if (links.length === 0) return;

  // Crear navegador
  const nav = document.createElement("div");
  nav.id = "polibaldeo-nav";
  nav.innerHTML = `
    <div class="pb-nav-inner">
      <button class="pb-nav-arrow" id="pb-nav-prev" title="Anterior">‹</button>
      <div class="pb-nav-pages" id="pb-nav-pages"></div>
      <button class="pb-nav-arrow" id="pb-nav-next" title="Siguiente">›</button>
    </div>
  `;

  const target = document.querySelector("#container h1:nth-of-type(2)");
  if (target) {
    target.insertAdjacentElement('afterend', nav);
  } else {
    const table = document.querySelector("table[bgcolor]");
    if (table) table.parentNode.insertBefore(nav, table);
  }

  const pageContainer = nav.querySelector("#pb-nav-pages");
  const prevBtn = nav.querySelector("#pb-nav-prev");
  const nextBtn = nav.querySelector("#pb-nav-next");

  function navigateTo(url) {
    if (url) location.assign(url);
  }

  function createPageButton(link) {
    const btn = document.createElement("button");
    btn.className = "pb-nav-page" + (link.href === null ? " active" : "");
    btn.textContent = link.num;
    btn.title = "Paralelo " + link.num;
    if (link.href) {
      btn.onclick = function(e) {
        e.preventDefault();
        navigateTo(link.href);
      };
    }
    return btn;
  }

  function createEllipsis() {
    const span = document.createElement("span");
    span.className = "pb-nav-dots";
    span.textContent = "...";
    return span;
  }

  function renderPages() {
    pageContainer.innerHTML = '';
    const total = links.length;
    const maxVisible = 7;
    const currentIdx = links.findIndex(l => l.num === currentNum);
    if (currentIdx === -1) return;

    if (total <= maxVisible) {
      links.forEach(link => pageContainer.appendChild(createPageButton(link)));
    } else {
      let start = Math.max(0, currentIdx - 3);
      let end = start + maxVisible;
      if (end > total) {
        end = total;
        start = end - maxVisible;
      }
      if (start > 0) {
        pageContainer.appendChild(createPageButton(links[0]));
        if (start > 1) pageContainer.appendChild(createEllipsis());
      }
      for (let i = start; i < end; i++) {
        pageContainer.appendChild(createPageButton(links[i]));
      }
      if (end < total) {
        if (end < total - 1) pageContainer.appendChild(createEllipsis());
        pageContainer.appendChild(createPageButton(links[total - 1]));
      }
    }
  }

  // ── Flechas de navegación ──────────────────────────────
  const currentIdx = links.findIndex(l => l.num === currentNum);

  function goTo(index) {
    if (index >= 0 && index < links.length && links[index].href) {
      window.location.href = links[index].href;
    }
  }

  prevBtn.onclick = function(e) {
    e.preventDefault();
    goTo(currentIdx - 1);
  };
  nextBtn.onclick = function(e) {
    e.preventDefault();
    goTo(currentIdx + 1);
  };

  prevBtn.disabled = (currentIdx <= 0 || !links[currentIdx - 1].href);
  nextBtn.disabled = (currentIdx >= links.length - 1 || !links[currentIdx + 1].href);
  if (prevBtn.disabled) prevBtn.style.opacity = '0.5'; else prevBtn.style.opacity = '1';
  if (nextBtn.disabled) nextBtn.style.opacity = '0.5'; else nextBtn.style.opacity = '1';

  renderPages();
}

// ── Inicialización ─────────────────────────────────────────
function init() {
  injectParaleloNavigator();
  injectButton();
  // Limpiar <br> extra entre el botón y la tabla
  var container = document.getElementById("container");
  if (container) {
    var brs = container.querySelectorAll("br");
    // Eliminar todos los <br> que aparecen después del botón (o navegador)
    // pero conservar los que están dentro de tablas o títulos.
    brs.forEach(function(br) {
      // Solo eliminar si está suelto y no dentro de elementos importantes
      if (br.parentNode === container || br.parentNode.tagName === 'DIV' && br.parentNode.id !== 'polibaldeo-nav') {
        br.remove();
      }
    });
  }
}

init();
new MutationObserver(init).observe(document.body, { childList: true, subtree: true });