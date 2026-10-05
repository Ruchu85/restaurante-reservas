/* Calculadora de comisiones y no-shows. Todo se calcula en el navegador: no se
   envía ni se guarda nada. Las cifras de competidores son estimaciones de
   comparativas de terceros (ver /precios-thefork y /precios-covermanager). */
(function () {
  var CITALISTA_MES = 20;
  var COVER_CUOTA = 79;
  var COVER_POR_RESERVA = 1.5;
  var SEMANAS_POR_MES = 4.33;

  var $ = function (id) { return document.getElementById(id); };
  var euros = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  });
  var num = function (id) {
    var v = parseFloat(String($(id).value).replace(',', '.'));
    return isFinite(v) && v >= 0 ? v : 0;
  };

  function calcular() {
    var comensales = num('c-comensales');
    var comision = num('c-comision');
    var reservas = num('c-reservas');
    var personas = num('c-personas') || 1;
    var ticket = num('c-ticket');
    var tasa = Math.min(num('c-noshow'), 100) / 100;

    var portalMes = comensales * comision;
    var portalAnio = portalMes * 12;
    var citaAnio = CITALISTA_MES * 12;
    var ahorro = portalAnio - citaAnio;

    var noshowMes = reservas * personas * tasa * ticket;
    var coverMes = COVER_CUOTA + reservas * COVER_POR_RESERVA;

    $('o-portal-mes').textContent = euros.format(portalMes);
    $('o-portal-anio').textContent = euros.format(portalAnio);
    $('o-noshow-mes').textContent = euros.format(noshowMes);
    $('o-noshow-anio').textContent = euros.format(noshowMes * 12);
    $('o-cover-mes').textContent = euros.format(coverMes);

    var cifra = $('o-ahorro');
    var nota = $('o-ahorro-nota');
    if (ahorro > 0) {
      cifra.textContent = euros.format(ahorro);
      nota.textContent = 'menos al año con cuota fija, si esos comensales vinieran igual por tu web.';
    } else if (portalAnio === 0) {
      cifra.textContent = '—';
      nota.textContent = 'Escribe cuántos comensales llegan por un portal para ver la diferencia.';
    } else {
      cifra.textContent = euros.format(Math.abs(ahorro));
      nota.textContent = 'es lo que ahorra el portal frente a la cuota fija con tus números. Con tan pocos comensales, no te compensa cambiar.';
    }
  }

  ['c-comensales', 'c-comision', 'c-reservas', 'c-personas', 'c-ticket', 'c-noshow']
    .forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', calcular);
    });
  calcular();
})();
