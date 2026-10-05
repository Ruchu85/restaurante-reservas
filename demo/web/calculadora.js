/* Calculadora de comisiones y no-shows. Todo se calcula en el navegador: no se
   envía ni se guarda nada. Las cifras de competidores son estimaciones de
   comparativas de terceros (ver /precios-thefork y /precios-covermanager). */
(function () {
  var CITALISTA_MES = 20;
  var COVER_CUOTA = 79;
  var COVER_POR_RESERVA = 1.5;

  var CAMPOS = ['comensales', 'comision', 'reservas', 'personas', 'ticket', 'noshow'];
  var PRESETS = {
    pequeno: { comensales: 100, comision: 2.25, reservas: 80,  personas: 2.6, ticket: 25, noshow: 3.3 },
    medio:   { comensales: 200, comision: 2.25, reservas: 150, personas: 2.8, ticket: 30, noshow: 3.3 },
    grande:  { comensales: 500, comision: 2.25, reservas: 400, personas: 3.0, ticket: 40, noshow: 3.3 }
  };

  var $ = function (id) { return document.getElementById(id); };
  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // useGrouping:'always' hace que 5160 salga como 5.160 (el español no agrupa los
  // cuatro dígitos por defecto, y en una cifra grande se lee peor).
  var fmt = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always'
  });
  var fmtNum = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' });

  function leer(id) {
    var v = parseFloat(String($('c-' + id).value).replace(',', '.'));
    return isFinite(v) && v >= 0 ? v : 0;
  }

  // Cuenta animada hacia el valor nuevo. Con "reducir movimiento" salta directo.
  var anim = {};
  function contar(el, hasta, formato) {
    var desde = el._valor || 0;
    el._valor = hasta;
    if (reducido || desde === hasta) { el.textContent = formato(hasta); return; }
    var t0 = null, dur = 450;
    cancelAnimationFrame(anim[el.id]);
    function paso(t) {
      if (t0 === null) t0 = t;
      var k = Math.min((t - t0) / dur, 1);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = formato(desde + (hasta - desde) * e);
      if (k < 1) anim[el.id] = requestAnimationFrame(paso);
    }
    anim[el.id] = requestAnimationFrame(paso);
  }

  function calcular() {
    var comensales = leer('comensales');
    var comision = leer('comision');
    var reservas = leer('reservas');
    var personas = leer('personas') || 1;
    var ticket = leer('ticket');
    var tasa = Math.min(leer('noshow'), 100) / 100;

    var portalAnio = comensales * comision * 12;
    var coverAnio = (COVER_CUOTA + reservas * COVER_POR_RESERVA) * 12;
    var citaAnio = CITALISTA_MES * 12;
    var diferencia = portalAnio - citaAnio;

    var personasPerdidas = reservas * personas * tasa;
    var noshowMes = personasPerdidas * ticket;

    // Cabecera: el mensaje depende de si el portal sale más caro o no.
    var etq = $('h-etq'), sub = $('h-sub');
    if (portalAnio === 0) {
      etq.textContent = 'Con cuota fija, al año te ahorrarías';
      sub.textContent = 'Indica cuántos comensales llegan por un portal para ver la diferencia.';
      contar($('h-num'), 0, fmt.format);
    } else if (diferencia > 0) {
      etq.textContent = 'Con cuota fija, al año te ahorrarías';
      sub.textContent = 'Con tus números, si esos comensales vinieran igual por tu web.';
      contar($('h-num'), diferencia, fmt.format);
    } else {
      etq.textContent = 'Con tus números, el portal te sale más barato';
      sub.textContent = 'Con tan pocos comensales, la comisión no llega a la cuota fija: no te compensaría cambiar.';
      contar($('h-num'), Math.abs(diferencia), fmt.format);
    }

    // Barras: la más larga ocupa el 100 %.
    var max = Math.max(portalAnio, coverAnio, citaAnio, 1);
    var barras = { portal: portalAnio, cover: coverAnio, cita: citaAnio };
    Object.keys(barras).forEach(function (k) {
      $('b-' + k).style.width = Math.max((barras[k] / max) * 100, 1.5) + '%';
      var v = $('v-' + k);
      v.textContent = fmt.format(barras[k]);
    });

    contar($('o-noshow-mes'), noshowMes, fmt.format);
    $('o-noshow-anio').textContent = fmt.format(noshowMes * 12);
    $('o-noshow-pers').textContent = fmtNum.format(Math.round(personasPerdidas));
  }

  // Relleno del deslizador (la parte recorrida en naranja).
  function pintar(r) {
    var min = parseFloat(r.min), max = parseFloat(r.max), v = parseFloat(r.value);
    var p = max > min ? ((v - min) / (max - min)) * 100 : 0;
    r.style.setProperty('--p', Math.min(Math.max(p, 0), 100) + '%');
  }

  CAMPOS.forEach(function (id) {
    var n = $('c-' + id), r = $('c-' + id + '-r');
    r.addEventListener('input', function () { n.value = r.value; pintar(r); marcarPreset(null); calcular(); });
    n.addEventListener('input', function () { r.value = n.value; pintar(r); marcarPreset(null); calcular(); });
  });

  var chips = document.querySelectorAll('.chip');
  function marcarPreset(nombre) {
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.preset === nombre)); });
  }
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var p = PRESETS[c.dataset.preset];
      CAMPOS.forEach(function (id) {
        $('c-' + id).value = p[id];
        var r = $('c-' + id + '-r');
        r.value = p[id];
        pintar(r);
      });
      marcarPreset(c.dataset.preset);
      calcular();
    });
  });

  CAMPOS.forEach(function (id) { pintar($('c-' + id + '-r')); });
  calcular();
})();
