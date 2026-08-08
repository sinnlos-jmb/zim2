/* ============================================================================
   panels.js - comportamiento comun de la sidebar, para todas las secciones.

   Antes esto vivía dentro de ui.js y solo existía en la app de búsquedas.
   Al sacarlo afuera, cualquier seccion nueva tiene el mismo panel lateral
   plegable sin copiar una linea: alcanza con incluir este script.

   1. #sbtoggle abre y cierra la sidebar (columna en escritorio, cajon en movil)
   2. .sbtitle[data-target] pliega y despliega cada bloque, y recuerda el estado
   ========================================================================= */
(function () {
  'use strict';

  var SB_KEY = 'en1:sidebar';
  var SEC_KEY = 'en1:panels:' + (document.body.dataset.section || 'x');
  var mobile = function () { return window.matchMedia('(max-width:820px)').matches; };

  /* ------------------------------------------------- 1. sidebar completa -- */
  function setSidebar(open) {
    var tg = document.getElementById('sbtoggle');
    document.body.classList.toggle(mobile() ? 'sb-open' : 'sb-off', mobile() ? open : !open);
    if (tg) tg.setAttribute('aria-expanded', String(open));
    if (!mobile()) { try { localStorage.setItem(SB_KEY, open ? 'open' : 'off'); } catch (e) {} }
  }

  function wireSidebar() {
    var tg = document.getElementById('sbtoggle');
    var sb = document.getElementById('sb');
    if (!tg || !sb) return; // secciones sin panel lateral (la landing)
    tg.addEventListener('click', function () {
      setSidebar(mobile() ? !document.body.classList.contains('sb-open') : document.body.classList.contains('sb-off'));
    });
    var scrim = document.getElementById('scrim');
    if (scrim) scrim.addEventListener('click', function () { setSidebar(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobile()) setSidebar(false);
    });
    // en movil el cajon arranca cerrado siempre; en escritorio se recuerda
    if (mobile()) document.body.classList.remove('sb-open');
    else {
      var s = null;
      try { s = localStorage.getItem(SB_KEY); } catch (e) {}
      if (s === 'off') document.body.classList.add('sb-off');
    }
  }

  /* ------------------------------------------- 2. bloques plegables ------- */
  function readState() {
    try { return JSON.parse(localStorage.getItem(SEC_KEY) || '{}'); } catch (e) { return {}; }
  }
  function writeState(st) {
    try { localStorage.setItem(SEC_KEY, JSON.stringify(st)); } catch (e) {}
  }

  function wirePanels() {
    var st = readState();
    document.querySelectorAll('.sbtitle[data-target]').forEach(function (btn) {
      var body = document.getElementById(btn.dataset.target);
      if (!body) return;
      // el HTML define el estado por defecto; localStorage lo pisa si hay memoria
      var open = btn.dataset.target in st ? st[btn.dataset.target] : btn.getAttribute('aria-expanded') !== 'false';
      var apply = function (o) {
        body.hidden = !o;
        btn.setAttribute('aria-expanded', String(o));
      };
      apply(open);
      btn.addEventListener('click', function () {
        var next = btn.getAttribute('aria-expanded') === 'false';
        apply(next);
        st[btn.dataset.target] = next;
        writeState(st);
      });
    });
  }

  function start() { wireSidebar(); wirePanels(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.PANELS = { setSidebar: setSidebar, isMobile: mobile };
})();
