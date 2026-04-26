// ── Botón Polibaldeo ──────────────────────────────────────
function injectButton() {
  if (document.getElementById("polibaldeo-btn-wrap")) return;

  const nav = document.getElementById("polibaldeo-nav");
  let insertAfter = nav;
  if (!insertAfter) {
    // fallback: insertar después del título "Materia Planificada"
    insertAfter = document.querySelector("#container h1:nth-of-type(2)");
    if (!insertAfter) return;
  }

  const wrap = document.createElement("div");
  wrap.id = "polibaldeo-btn-wrap";
  wrap.style.cssText = "display: flex; justify-content: center; margin: 16px 0;";

  const button = document.createElement("button");
  button.id = "polibaldeo-add-btn";
  button.type = "button";
  button.textContent = "📌 Añadir a PoliBaldeo";
  button.onclick = captureData;

  wrap.appendChild(button);
  insertAfter.insertAdjacentElement("afterend", wrap);
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