/**
 * utm-capture.js, Aruna
 *
 * 1. Captura UTMs e gclid no first touch e persiste em localStorage por 30 dias.
 * 2. Injeta esses parametros em qualquer link wa.me ou api.whatsapp.com da pagina,
 *    e adiciona uma tag tipo [src:google|cmp:bi] na mensagem inicial pra Yanna IA
 *    parsear no atendimento e gravar como custom field no Kommo.
 * 3. Expoe window.ArunaUTM com {utm_source, utm_medium, utm_campaign, utm_content,
 *    utm_term, gclid, first_touch_at} pra outros scripts (ex: GTM custom HTML).
 *
 * Carregar com defer ou no fim do <body>.
 */
(function () {
  var STORAGE_KEY = 'aruna_utm';
  var TTL_DAYS = 30;

  function readStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var ageMs = Date.now() - (parsed.first_touch_at_ms || 0);
      if (ageMs > TTL_DAYS * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeStorage(payload) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // localStorage cheio ou bloqueado; ignorar
    }
  }

  function paramsFromUrl() {
    var search = window.location.search;
    if (!search) return {};
    var out = {};
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
    var sp = new URLSearchParams(search);
    keys.forEach(function (k) {
      var v = sp.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  function pageProduct() {
    var p = window.location.pathname.toLowerCase();
    if (p.indexOf('/bi') === 0 || p.indexOf('/bi/') !== -1) return 'bi';
    if (p.indexOf('/kommo') === 0 || p.indexOf('/kommo/') !== -1) return 'kommo';
    if (p.indexOf('/automacao') === 0 || p.indexOf('/automacao/') !== -1) return 'automacao';
    return 'home';
  }

  function buildShortTag(state) {
    var src = (state.utm_source || 'direct').slice(0, 12);
    var cmp = (state.utm_campaign || pageProduct()).slice(0, 24);
    return '[src:' + src + '|cmp:' + cmp + ']';
  }

  function isWhatsappLink(href) {
    if (!href) return false;
    return /(?:wa\.me|api\.whatsapp\.com)/i.test(href);
  }

  function injectIntoWhatsapp(state) {
    var links = document.querySelectorAll('a[href]');
    var tag = buildShortTag(state);

    links.forEach(function (a) {
      var href = a.getAttribute('href');
      if (!isWhatsappLink(href)) return;

      try {
        var url = new URL(href, window.location.origin);
        var existingText = url.searchParams.get('text') || '';
        if (existingText.indexOf('[src:') === -1) {
          var newText = existingText
            ? existingText + ' ' + tag
            : 'Quero saber mais sobre ' + pageProduct().toUpperCase() + ' ' + tag;
          url.searchParams.set('text', newText);
        }
        // Adiciona utms no proprio href como query, alguns parsers do lado da Aruna leem isso
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid'].forEach(function (k) {
          if (state[k] && !url.searchParams.has(k)) {
            url.searchParams.set(k, state[k]);
          }
        });
        a.setAttribute('href', url.toString());
      } catch (e) {
        // href invalido, ignorar
      }
    });
  }

  function init() {
    var current = readStorage();
    var fromUrl = paramsFromUrl();
    var hasNew = Object.keys(fromUrl).length > 0;

    var state;
    if (current && !hasNew) {
      // first touch ja capturado, mantem
      state = current;
    } else if (hasNew) {
      // Ou nao tem nada salvo, ou veio com novos UTMs (last touch atualiza somente se primeiro)
      state = current || {
        first_touch_at: new Date().toISOString(),
        first_touch_at_ms: Date.now(),
      };
      Object.keys(fromUrl).forEach(function (k) {
        // Conservador: nao sobrescreve UTM ja existente do first touch.
        if (!state[k]) state[k] = fromUrl[k];
      });
      writeStorage(state);
    } else {
      // Direct/organico, sem nada salvo
      state = {
        utm_source: 'direct',
        first_touch_at: new Date().toISOString(),
        first_touch_at_ms: Date.now(),
      };
      writeStorage(state);
    }

    window.ArunaUTM = state;
    injectIntoWhatsapp(state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
