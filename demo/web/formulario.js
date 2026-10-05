/* Formulario de prueba gratuita. Compartido por todas las páginas.
   - Si el enlace trae ?r=Nombre, rellena el restaurante y personaliza la portada.
   - Recuerda de dónde viene la visita (utm_*, ref) durante la sesión, para que el
     aviso por correo diga qué campaña trajo la solicitud.
   - Al enviar bien, lleva a /gracias: así Vercel Analytics cuenta la conversión
     como una visita (el plan Hobby no permite eventos personalizados). */
(function () {
  var CLAVE = 'cl_origen';

  function leer() {
    try { return JSON.parse(sessionStorage.getItem(CLAVE) || '{}'); } catch (e) { return {}; }
  }
  function guardar(o) {
    try { sessionStorage.setItem(CLAVE, JSON.stringify(o)); } catch (e) { /* modo privado */ }
  }

  var q = new URLSearchParams(location.search);
  var o = leer();
  var r = (q.get('r') || '').trim().slice(0, 60);
  var fuente = [q.get('utm_source'), q.get('utm_medium'), q.get('utm_campaign'), q.get('ref')]
    .filter(Boolean).join(' / ').slice(0, 160);
  if (r) o.r = r;
  if (fuente) o.fuente = fuente;
  if (r || fuente) guardar(o);

  // Personalización de la portada (solo donde la página lo pide).
  if (o.r && document.body.hasAttribute('data-saludo')) {
    var pill = document.querySelector('.portada .pill');
    if (pill) pill.textContent = 'Preparado para ' + o.r + ' · desde 20 €/mes';
    var cierre = document.querySelector('.cierre h2');
    if (cierre) cierre.textContent = 'Pruébalo en ' + o.r;
  }

  var f = document.getElementById('form-prueba');
  if (!f) return;
  var out = document.getElementById('form-resultado');
  var boton = f.querySelector('button[type=submit]');

  var campoRest = document.getElementById('f-restaurante');
  if (campoRest && !campoRest.value && o.r) campoRest.value = o.r;
  var campoOrigen = document.getElementById('f-origen');
  if (campoOrigen) campoOrigen.value = o.fuente || '';

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var datos = {};
    new FormData(f).forEach(function (v, k) { datos[k] = v; });
    var texto = boton.textContent;
    boton.disabled = true; boton.textContent = 'Enviando…';
    out.className = 'resultado';
    fetch('/api/contacto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    })
      .then(function (r2) { return r2.json().then(function (j) { return { ok: r2.ok && j.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) { location.href = '/gracias'; return; }
        out.className = 'resultado mal';
        out.textContent = (res.j && res.j.error) || 'No se pudo enviar. Escríbeme a pablo.fernandez@cita-lista.es.';
        boton.disabled = false; boton.textContent = texto;
      })
      .catch(function () {
        out.className = 'resultado mal';
        out.textContent = 'No se pudo enviar. Escríbeme a pablo.fernandez@cita-lista.es.';
        boton.disabled = false; boton.textContent = texto;
      });
  });
})();
