/* ============================================================================
   shell.js - barra de secciones compartida.

   Una sola fuente de verdad para el menu: agregar una seccion es agregar un
   objeto a SECTIONS y crear su .html. Ninguna pagina repite el markup del
   header, asi que no hay forma de que una quede desincronizada.

   Uso: <body data-section="busquedas"> + <script src="js/shell.js"></script>
   ========================================================================= */
(function () {
  'use strict';

  // Iconos: SVG inline con stroke=currentColor, para que hereden el color del
  // estado activo sin cargar una fuente de iconos ni pedir nada a la red.
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/>',
    // lupa: la seccion hermeneutica, preguntar al texto
    busquedas: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
    // destello: lectura asistida
    ia: '<path d="M12 3.2 13.9 9 20 10.9 13.9 12.8 12 18.6 10.1 12.8 4 10.9 10.1 9Z"/><path d="M18.5 3v3.4M20.2 4.7h-3.4"/>',
    // grafo: nodos y aristas, los paseos
    paseos: '<circle cx="6" cy="17.5" r="2.6"/><circle cx="12" cy="5.5" r="2.6"/><circle cx="18.5" cy="15" r="2.6"/><path d="M7.6 15.4 10.7 7.9"/><path d="M13.6 7.4l3.6 5.4"/><path d="M8.6 17.1l7.3-1.6"/>',
    // dos figuras: comunidad
    comunidad: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M16 5.4a3.2 3.2 0 0 1 0 6"/><path d="M17.2 14.9c2 .5 3.4 2.2 3.8 4.6"/>',
    // matraz: el laboratorio de inspeccion del corpus
    lab: '<path d="M10 3v5.4L5.6 16.7A3 3 0 0 0 8.3 21h7.4a3 3 0 0 0 2.7-4.3L14 8.4V3"/><path d="M8.5 3h7"/><path d="M6.8 15h10.4"/>'
  };

  var SECTIONS = [
    { id: 'home', href: 'index.html', label: 'Inicio', title: 'Inicio: qué es el proyecto' },
    { id: 'busquedas', href: 'busquedas.html', label: 'Búsquedas', title: 'Búsquedas: preguntar al texto por ejes semánticos' },
    { id: 'ia', href: 'ia.html', label: 'IA', title: 'IA: lectura asistida (en preparación)', wip: true },
    { id: 'paseos', href: 'paseos.html', label: 'Paseos', title: 'Paseos: recorrer el texto como un grafo' },
    { id: 'comunidad', href: 'comunidad.html', label: 'Comunidad', title: 'Comunidad: leer y anotar entre varios (en preparación)', wip: true },
    { id: 'lab', href: 'lab.html', label: 'Lab', title: 'Lab: inspección del corpus párrafo por párrafo (solo lectura)' }
  ];

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(id) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[id] || '';
    return s;
  }

  function buildTopbar(active) {
    var bar = document.getElementById('topbar');
    if (!bar) return;

    // 1. plegar la sidebar (ui.js le engancha el comportamiento si existe)
    if (!bar.querySelector('#sbtoggle')) {
      var tg = document.createElement('button');
      tg.id = 'sbtoggle';
      tg.type = 'button';
      tg.textContent = '☰';
      tg.setAttribute('aria-label', 'Mostrar u ocultar el panel lateral');
      tg.setAttribute('aria-expanded', 'true');
      bar.append(tg);
    }

    // 2. marca
    var logo = document.createElement('a');
    logo.className = 'logo';
    logo.href = 'index.html';
    logo.innerHTML =
      '<span class="mark">ΗΝ</span>' +
      '<span class="tit"><b>Ética Nicomaquea</b><span>Libro I · edición vectorizada</span></span>';
    bar.append(logo);

    // 3. secciones
    var nav = document.createElement('nav');
    nav.id = 'secnav';
    nav.setAttribute('aria-label', 'Secciones');
    SECTIONS.forEach(function (s) {
      var a = document.createElement('a');
      a.href = s.href;
      a.title = s.title;
      if (s.wip) a.className = 'wip';
      if (s.id === active) a.setAttribute('aria-current', 'page');
      a.append(icon(s.id));
      var lab = document.createElement('span');
      lab.className = 'lab';
      lab.textContent = s.label;
      a.append(lab);
      nav.append(a);
    });
    bar.append(nav);

    // 4. margen derecho
    var right = document.createElement('div');
    right.className = 'tbright';
    var note = document.createElement('span');
    note.className = 'tbnote';
    note.textContent = 'traducción propia · en curso';
    right.append(note);
    bar.append(right);
  }

  /* Migas del main. Cada nivel puede llevar onClick; el ultimo es el actual.
     La usa busquedas.html (desde ui.js) y cualquier seccion futura.
     items: [{ label, icon?, onClick? }], opts: { onClear? }                */
  function crumbs(items, opts) {
    var box = document.getElementById('crumbs');
    if (!box) return;
    box.innerHTML = '';
    opts = opts || {};
    items.forEach(function (it, i) {
      if (i) {
        var sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '›';
        box.append(sep);
      }
      var last = i === items.length - 1;
      var node = document.createElement(it.onClick && !last ? 'button' : 'span');
      node.className = 'cr' + (last ? ' here' : '');
      if (node.tagName === 'BUTTON') {
        node.type = 'button';
        node.onclick = it.onClick;
      }
      if (it.icon) {
        var ic = document.createElement('span');
        ic.className = 'ic';
        ic.textContent = it.icon;
        node.append(ic);
      }
      var tx = document.createElement('span');
      tx.textContent = it.label;
      node.append(tx);
      box.append(node);
    });
    if (opts.onClear) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'crclear';
      c.textContent = 'limpiar';
      c.onclick = opts.onClear;
      box.append(c);
    }
  }

  window.SHELL = { sections: SECTIONS, crumbs: crumbs, icon: icon };

  function start() { buildTopbar(document.body.dataset.section || ''); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
