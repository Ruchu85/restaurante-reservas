// Build de Cita-Lista: genera /public a partir de los archivos del proyecto.
// 1. Copia el sitio. 2. Descarga el vídeo de fondo (Mixkit, licencia libre) para servirlo desde el propio dominio.
// 3. Une estilo.css con la capa v2. 4. Aplica cabecera, banda sobre el vídeo fijo y menú móvil a las páginas interiores.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();
const SALIDA = path.join(RAIZ, 'public');
const EXCLUIR = new Set(['public', 'node_modules', 'api', '.vercel', '.git', 'build.mjs', 'package.json', 'package-lock.json', 'vercel.json', 'estilo-v2.css']);

async function copiar(origen, destino) {
  const st = await fs.stat(origen);
  if (st.isDirectory()) {
    await fs.mkdir(destino, { recursive: true });
    for (const n of await fs.readdir(origen)) await copiar(path.join(origen, n), path.join(destino, n));
  } else await fs.copyFile(origen, destino);
}

async function descargar(url, destino) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      await fs.writeFile(destino, Buffer.from(await r.arrayBuffer()));
      return true;
    } catch (e) {
      console.warn(`Intento ${i} fallido para ${url}: ${e.message}`);
      await new Promise(res => setTimeout(res, 1500 * i));
    }
  }
  return false;
}

// Vídeo de fondo único para todo el sitio: luces cálidas desenfocadas (Mixkit 1172).
// Al ser un bokeh, la versión de 360p se ve igual de bien a pantalla completa y pesa 2,5 MB en vez de 12,6.
// Se reproduce automáticamente nada más abrir la página.
const VIDEO = { id: 1172, calidad: '360', nombre: 'luces-360.mp4' };
const FONDO = `<div class="fondo-fijo" aria-hidden="true"><video autoplay muted playsinline loop preload="auto" disablepictureinpicture disableremoteplayback tabindex="-1" src="/media/fondo/${VIDEO.nombre}"></video></div>`;

const ICONO_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const ICONO_CERRAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const BOTON_MENU = `<button class="menu-boton" type="button" popovertarget="menu-movil" aria-label="Abrir el menú">${ICONO_MENU}</button>`;
const MENU_MOVIL = `<nav id="menu-movil" popover aria-label="Menú"><button class="menu-boton cerrar" type="button" popovertarget="menu-movil" popovertargetaction="hide" aria-label="Cerrar el menú">${ICONO_CERRAR}</button><a href="/">Inicio</a><a href="/sistema-de-reservas-para-restaurantes">Sistema de reservas</a><a href="/pagina-web-para-restaurantes">Web para restaurantes</a><a href="/precios">Precios</a><a href="/alternativa-thefork">Alternativa a TheFork</a><a href="/alternativa-covermanager">Alternativa a CoverManager</a><a href="/sobre-mi">Quién está detrás</a><a class="btn" href="/#probar">Probar 30 días gratis</a></nav>`;
const CONTROL = '<button class="control-video" type="button" aria-pressed="false" aria-label="Pausar el vídeo de fondo"><svg class="ic-pausa" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg><svg class="ic-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg></button>';
const EXCL_SPEC = '{"not":{"href_matches":"/api/*"}},{"not":{"href_matches":"/demo"}},{"not":{"href_matches":"/ejemplo"}},{"not":{"href_matches":"/media/*"}}';
const ESPECULACION = `<script type="speculationrules">{"prefetch":[{"where":{"and":[{"href_matches":"/*"},${EXCL_SPEC}]},"eagerness":"moderate"}],"prerender":[{"where":{"and":[{"href_matches":"/*"},${EXCL_SPEC}]},"eagerness":"conservative"}]}</script>`;

// Devuelve el índice justo después del </div> que cierra el <div> que empieza en i
function finDiv(s, i) {
  const re = /<div\b|<\/div>/g; re.lastIndex = i; let prof = 0, m;
  while ((m = re.exec(s))) {
    prof += m[0] === '</div>' ? -1 : 1;
    if (prof === 0) return m.index + 6;
  }
  return -1;
}

// Localiza el bloque del título: contenedor .cabecera/.portada o h1 con su antetítulo y fecha
function grupoTitulo(s) {
  const h = s.search(/<h1[\s>]/);
  if (h < 0) return null;
  const re = /<div class="(?:cabecera|portada)\b[^"]*"[^>]*>/g; let m, mejor = null;
  while ((m = re.exec(s)) && m.index < h) {
    const fin = finDiv(s, m.index);
    if (fin > h) mejor = [m.index, fin];
  }
  if (mejor) return mejor;
  let ini = h, fin = s.indexOf('</h1>', h) + 5;
  const eb = s.slice(0, h).match(/<(p|span|div) class="eyebrow"[^>]*>[\s\S]*?<\/\1>\s*$/);
  if (eb) ini = h - eb[0].length;
  const fe = s.slice(fin).match(/^\s*<p class="fecha"[^>]*>[\s\S]*?<\/p>/);
  if (fe) fin += fe[0].length;
  return [ini, fin];
}

function transformar(s, nombre) {
  // Cabecera: menú móvil
  if (/<header>/.test(s)) {
    s = s.replace(/<\/div>(\s*)<\/header>/, `${BOTON_MENU}</div>$1</header>${MENU_MOVIL}`);
  }
  // Banda de título sobre el vídeo de fondo fijo
  const main = s.match(/<main\b[^>]*>/);
  if (main) {
    let migas = '';
    const mm = s.match(/<div class="wrap">\s*(<nav class="migas"[\s\S]*?<\/nav>)\s*<\/div>/);
    if (mm) { migas = mm[1]; s = s.replace(mm[0], ''); }
    const g = grupoTitulo(s);
    if (g) {
      const titulo = s.slice(g[0], g[1]);
      s = s.slice(0, g[0]) + s.slice(g[1]);
      const banda = `<div class="banda"><div class="wrap">${migas}${titulo}</div>${CONTROL}</div>`;
      s = s.replace(/<main\b[^>]*>/, m0 => banda + m0);
      s = s.replace(/<body([^>]*)>/, (m0, a) => (/class="/.test(a) ? m0.replace('class="', 'class="con-banda ') : `<body${a} class="con-banda">`) + FONDO);
    } else if (migas) {
      s = s.replace(/<main\b[^>]*>/, m0 => `<div class="wrap">${migas}</div>` + m0);
    }
  }
  // Enlaces con texto descriptivo (SEO)
  s = s.replace(/<a href="\/precios">\s*aquí\s*<\/a>/g, '<a href="/precios">en la página de precios</a>');
  // Cabeza: color de tema, precarga instantánea y script compartido
  s = s.replace(/<meta name="theme-color"[^>]*>\s*/g, '');
  s = s.replace('</head>', `<meta name="theme-color" content="#16100c">\n${ESPECULACION}\n<script src="/sitio.js" defer></script>\n</head>`);
  return s;
}

async function main() {
  await fs.rm(SALIDA, { recursive: true, force: true });
  await fs.mkdir(SALIDA, { recursive: true });
  for (const n of await fs.readdir(RAIZ)) if (!EXCLUIR.has(n)) await copiar(path.join(RAIZ, n), path.join(SALIDA, n));

  const dirVideo = path.join(SALIDA, 'media', 'fondo');
  await fs.mkdir(dirVideo, { recursive: true });
  const ok = await descargar(`https://assets.mixkit.co/videos/${VIDEO.id}/${VIDEO.id}-${VIDEO.calidad}.mp4`, path.join(dirVideo, VIDEO.nombre));
  console.log(ok ? 'Vídeo de fondo descargado' : 'AVISO: no se pudo descargar el vídeo de fondo; la web se verá con el degradado');

  const base = await fs.readFile(path.join(RAIZ, 'estilo.css'), 'utf8');
  const v2 = await fs.readFile(path.join(RAIZ, 'estilo-v2.css'), 'utf8');
  await fs.writeFile(path.join(SALIDA, 'estilo.css'), base + '\n' + v2);

  for (const n of await fs.readdir(SALIDA)) {
    if (!n.endsWith('.html') || n === 'index.html') continue;
    const p = path.join(SALIDA, n);
    await fs.writeFile(p, transformar(await fs.readFile(p, 'utf8'), n.replace(/\.html$/, '')));
    console.log('Página actualizada:', n);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
