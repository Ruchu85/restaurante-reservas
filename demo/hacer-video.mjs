/**
 * hacer-video.mjs — Genera el vídeo de demostración con locución.
 *
 *   node demo/hacer-video.mjs
 *
 * Qué hace, en orden:
 *  1. Sintetiza la voz de cada escena con edge-tts (voces neuronales de
 *     Microsoft, gratuitas y sin clave de API).
 *  2. Mide la duración real de cada audio. Las escenas duran lo que dura su
 *     locución, así que imagen y voz nunca se desincronizan.
 *  3. Construye una animación HTML con las capturas reales de la app.
 *  4. La graba con Playwright (vídeo mudo) y le pega el audio con ffmpeg.
 *
 * Requisitos: edge-tts en el venv de prospect-system y el binario de
 * ffmpeg-static (ver README de esta carpeta).
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, renameSync, rmSync, existsSync, readFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ESCENAS, VOZ, PAUSAS, RITMOS, MARCA, MARCA_COLA } from "./guion.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const CAPTURAS = join(DIR, "capturas");
const TRABAJO = join(DIR, ".trabajo");
// Por defecto el vídeo publicado (web/media/demo.mp4). Con SALIDA_VIDEO se genera
// aparte para poder escucharlo antes de sustituir el que ven los restaurantes.
const SALIDA = process.env.SALIDA_VIDEO || join(DIR, "web", "media");
const NOMBRE_VIDEO = process.env.NOMBRE_VIDEO || "demo.mp4";

// Motor de voz: "edge" (Azure, por defecto) o "chatterbox" (modelo local, ver
// voz-chatterbox.py). Chatterbox necesita su propio Python 3.12 con torch.
const MOTOR = process.env.MOTOR_VOZ || "edge";
const PY_VOZ = process.env.VOZ_PY || "python";
const REF_VOZ = process.env.VOZ_REFERENCIA || join(DIR, "voz", "ref-alvaro.wav");
const CACHE_VOZ = join(DIR, ".voz-chatterbox");
// Chatterbox habla a ~12,6 caracteres por segundo (una locución natural ronda
// 14-15) y los RITMOS del guion se pensaron para Azure, que va más rápido. Este
// factor se aplica al audio ya generado, así que no obliga a regenerar nada.
const TEMPO_VOZ = Number(process.env.VOZ_TEMPO || "1.10");

const PY = join(DIR, "..", "prospect-system", "venv", "Scripts", "python.exe");
const FFMPEG = process.env.FFMPEG_PATH || join(
  process.env.TEMP || "/tmp",
  "claude/d--Proyectos-Claude-APP-Restaurantes/7473faa5-088d-4d46-a279-3514556f8c10/scratchpad",
  "tools/node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg.exe",
);

// 1080p: 720p dejaba el texto fino de las capturas de interfaz notablemente
// menos nítido que el de la app real, sobre todo en los encuadres "detalle".
const ANCHO = 1920;
const ALTO = 1080;

rmSync(TRABAJO, { recursive: true, force: true });
mkdirSync(TRABAJO, { recursive: true });
mkdirSync(SALIDA, { recursive: true });

// ── 1. Locución ───────────────────────────────────────────────────────
/**
 * Parte la locución de una escena en frases, cada una con el silencio que le
 * toca detrás. Ver el comentario de PAUSAS en guion.mjs para el porqué.
 */
function segmentar(texto) {
  // Los "..." del guion son una petición de respiro, no puntuación real: se
  // convierten en marca propia antes de cortar para no confundirlos con un
  // punto final, y desaparecen del texto que oye el sintetizador.
  const piezas = texto.replace(/\s*\.\.\.\s*/g, " ¶ ").split("¶");
  const fuera = [];

  piezas.forEach((pieza, i) => {
    const frases = (pieza.match(/[^.!?]+[.!?]*/g) || []).map((f) => f.trim()).filter(Boolean);
    frases.forEach((frase, j) => {
      // Un trozo cortado por "..." se queda sin puntuación final y la voz lo
      // termina en seco, como si le hubieran quitado el micro. Con una coma
      // mantiene la entonación en suspenso, que es justo lo que pedía el "...".
      const texto = /[.!?,;:]$/.test(frase) ? frase : frase + ",";
      const ultimaDeLaPieza = j === frases.length - 1;
      const hayMasPiezas = i < piezas.length - 1;
      fuera.push({ texto, larga: ultimaDeLaPieza && hayMasPiezas });
    });
  });

  // Con las frases ya cortadas se puede medir cada corte por lo que tiene
  // delante y detrás, que es de donde sale la variación (ver PAUSAS).
  const LARGA = 95; // caracteres a partir de los cuales una frase pesa
  const CORTA = 55; // por debajo, una frase breve y con intención
  fuera.forEach((f, i) => {
    const siguiente = fuera[i + 1];

    // Tempo (ver RITMOS): lo marca el peso de la frase, y la última de cada
    // escena baja un punto más para cerrar la idea.
    const base =
      f.texto.length < CORTA ? RITMOS.golpe :
      f.texto.length > LARGA ? RITMOS.andamiaje :
                               RITMOS.normal;
    const pct = parseInt(base, 10) + (siguiente ? 0 : RITMOS.cierreEscena);
    f.ritmo = `${pct >= 0 ? "+" : ""}${pct}%`;

    if (!siguiente) {
      f.pausa = 0; // el silencio final lo pone la unión de escenas
      return;
    }
    let p = f.larga ? PAUSAS.larga : PAUSAS.frase;
    p += PAUSAS.porFraseLarga * Math.min(1, f.texto.length / LARGA);
    if (siguiente.texto.length < CORTA) p += PAUSAS.anteFraseCorta;
    f.pausa = Number(p.toFixed(3));
  });

  return fuera;
}

/**
 * Sintetiza una frase y le quita el silencio de los extremos.
 *
 * El motor devuelve cada clip con ~0,26 s de silencio delante y ~0,91 s
 * detrás. Sin recortarlo, ese casi segundo de aire se suma a la pausa que
 * pusiéramos nosotros: entre frase y frase quedaba metro y medio de silencio
 * y la locución sonaba pesada y desarticulada, además de alargar el vídeo 24 s
 * de puro relleno. Recortado, la pausa real es exactamente la que se pide en
 * PAUSAS. Solo se elimina el primer tramo de silencio por cada extremo
 * (start_periods=1), así que los respiros de dentro de la frase se respetan.
 */
const RECORTE = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0:detection=peak";
function tts(texto, destino, ritmo, clave) {
  const bruto = destino.replace(/\.mp3$/, ".bruto.mp3");
  if (MOTOR === "chatterbox") {
    // Las frases ya están generadas (y elegidas la mejor toma) en CACHE_VOZ.
    copyFileSync(join(CACHE_VOZ, `${clave}.mp3`), bruto);
  } else {
    execFileSync(PY, ["-m", "edge_tts", "--voice", VOZ, "--rate", ritmo, "--text", texto, "--write-media", bruto], {
      stdio: "pipe",
    });
  }
  execFileSync(FFMPEG, [
    "-y", "-i", bruto,
    "-af", `${RECORTE},areverse,${RECORTE},areverse${MOTOR === "chatterbox" ? `,atempo=${TEMPO_VOZ}` : ""}`,
    "-c:a", "libmp3lame", "-q:a", "3", destino,
  ], { stdio: "pipe" });
  rmSync(bruto, { force: true });
}

/**
 * Une varios mp3 metiendo detrás de cada uno el silencio que pide.
 * `entrada` son los milisegundos de silencio que van delante del primero.
 */
function unir(partes, destino, entrada = 0) {
  const entradas = partes.flatMap((p) => ["-i", p.archivo]);
  const filtro = partes
    .map((p, i) => `[${i}:a]${i === 0 && entrada ? `adelay=${entrada}|${entrada},` : ""}apad=pad_dur=${p.pausa}[a${i}]`)
    .join(";");
  const concat = partes.map((_, i) => `[a${i}]`).join("") + `concat=n=${partes.length}:v=0:a=1[out]`;
  execFileSync(FFMPEG, [
    "-y", ...entradas,
    "-filter_complex", `${filtro};${concat}`,
    "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "3", destino,
  ], { stdio: "pipe" });
}

if (MOTOR === "chatterbox") {
  // Se genera todo de una vez (cargar el modelo cuesta más de un minuto). El
  // guion escribe "Cita-Lista" con guion; hablado, sin él lo dice mejor.
  const manifiesto = ESCENAS.flatMap((e) =>
    segmentar(e.texto).map((f, i) => ({
      clave: `${e.id}-${i}`,
      texto: f.texto.replace(/Cita-Lista/g, "Cita Lista").replace(/PDF/g, "pe de efe"),
      ritmo: e.ritmo || f.ritmo,
    })),
  );
  mkdirSync(CACHE_VOZ, { recursive: true });
  const man = join(CACHE_VOZ, "manifiesto.json");
  writeFileSync(man, JSON.stringify(manifiesto, null, 1));
  console.log(`Generando ${manifiesto.length} frases con Chatterbox (caché: ${CACHE_VOZ})…`);
  execFileSync(PY_VOZ, [join(DIR, "voz-chatterbox.py"), man, CACHE_VOZ, "--referencia", REF_VOZ, "--tomas", process.env.VOZ_TOMAS || "3"], {
    stdio: "inherit",
    env: { ...process.env, FFMPEG: FFMPEG },
  });
}

console.log(`Sintetizando ${ESCENAS.length} locuciones con ${MOTOR === "chatterbox" ? "Chatterbox" : VOZ}…`);
for (const e of ESCENAS) {
  const frases = segmentar(e.texto);
  const partes = frases.map((f, i) => {
    const archivo = join(TRABAJO, `f-${e.id}-${i}.mp3`);
    tts(f.texto, archivo, e.ritmo || f.ritmo, `${e.id}-${i}`);
    return { archivo, pausa: f.pausa };
  });
  // Solo la primera escena lleva entrada: el resto ya viene precedido por el
  // silencio de cambio de escena.
  const entrada = e === ESCENAS[0] ? Math.round(PAUSAS.entrada * 1000) : 0;
  unir(partes, join(TRABAJO, `voz-${e.id}.mp3`), entrada);
  process.stdout.write(`  ${e.id}(${frases.length})`);
}
console.log();

// ── 2. Duración real de cada escena ───────────────────────────────────
function segundos(archivo) {
  let texto = "";
  try {
    execFileSync(FFMPEG, ["-i", archivo], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    texto = (err.stderr || "").toString();
  }
  const m = texto.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error(`No se pudo medir ${archivo}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const PAUSA = PAUSAS.escena; // respiración entre escenas
const escenas = ESCENAS.map((e) => {
  const d = segundos(join(TRABAJO, `voz-${e.id}.mp3`));
  return { ...e, dur: d + PAUSA };
});
const total = escenas.reduce((s, e) => s + e.dur, 0);
console.log(`Duración total: ${total.toFixed(1)} s`);

// ── 3. Audio único ────────────────────────────────────────────────────
// Se concatena insertando el silencio de la pausa detrás de cada locución.
const filtro = escenas
  .map((_, i) => `[${i}:a]adelay=0|0,apad=pad_dur=${PAUSA}[a${i}]`)
  .join(";");
const entradas = escenas.flatMap((e) => ["-i", join(TRABAJO, `voz-${e.id}.mp3`)]);
const concat = escenas.map((_, i) => `[a${i}]`).join("") + `concat=n=${escenas.length}:v=0:a=1[out]`;

execFileSync(FFMPEG, [
  "-y", ...entradas,
  "-filter_complex", `${filtro};${concat}`,
  "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "3",
  join(TRABAJO, MOTOR === "chatterbox" ? "narracion-sin-nivelar.mp3" : "narracion.mp3"),
], { stdio: "pipe" });
if (MOTOR === "chatterbox") {
  // Solo nivel (-16 LUFS, el estándar de vídeo web) y un corte de graves que no
  // se oyen: el modelo no trae el mismo volumen que Azure y no quiero meter
  // efectos de oído (reverb, saturación) sin poder escucharlos.
  execFileSync(FFMPEG, [
    "-y", "-i", join(TRABAJO, "narracion-sin-nivelar.mp3"),
    "-af", "highpass=f=70,loudnorm=I=-16:LRA=11:TP=-1.5",
    "-c:a", "libmp3lame", "-q:a", "3", join(TRABAJO, "narracion.mp3"),
  ], { stdio: "pipe" });
}
console.log("Audio unificado.");

// ── 4. Animación HTML ─────────────────────────────────────────────────
// La plantilla visual reutiliza la identidad de la web real: Fraunces para
// titulares, ámbar-700 de acento, fondo piedra oscuro — para que el vídeo se
// sienta parte del mismo producto y no un genérico "explicador" de stock.
function b64(archivo) {
  return readFileSync(join(CAPTURAS, archivo)).toString("base64");
}
const imagenes = {};
for (const e of escenas) if (e.imagen && !imagenes[e.imagen]) imagenes[e.imagen] = b64(e.imagen);

let t = 0;
const conTiempo = escenas.map((e) => {
  const inicio = t;
  t += e.dur;
  return { ...e, inicio };
});

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${ANCHO}px;height:${ALTO}px;overflow:hidden;background:#161311;
     font-family:'Inter',system-ui,sans-serif;color:#fff}
.fondo{position:absolute;inset:0;background:
  radial-gradient(1200px 700px at 15% -10%, rgba(180,83,9,.16), transparent 60%),
  radial-gradient(900px 600px at 100% 110%, rgba(180,83,9,.10), transparent 55%),
  #161311}
.escena{position:absolute;inset:0;opacity:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;padding:60px 90px 150px;
        transition:opacity .5s ease}
.escena.on{opacity:1}
.marco{position:relative;width:100%;max-width:1515px;height:693px;border-radius:24px;
       overflow:hidden;box-shadow:0 45px 120px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06);
       background:#fff}
.marco img{position:absolute;left:0;top:0;width:100%;transform-origin:top center}
.marco.movil{max-width:432px;height:837px;border-radius:39px}
.marco.movil img{width:100%}
/* Recorte de conversación: casi cuadrado, para que el mensaje se lea también
   cuando el vídeo se ve en un teléfono, que es como llega por WhatsApp. */
.marco.chat{max-width:760px;height:728px;border-radius:28px}
/* Un paso del formulario de reserva, recortado: proporción propia para que las
   horas se lean sin tener que enseñar el teléfono entero. */
.marco.paso{max-width:880px;height:722px;border-radius:26px}
/* El desplazamiento vertical del zoom se fija por escena (estilo inline,
   variable --zoom-top) en vez de aquí: dos escenas usan "detalle" sobre
   capturas distintas, y una posición fija para las dos dejaba la fila con
   la etiqueta de alergia fuera del encuadre en la escena que la menciona. */
/* -26%, no -14%: la barra lateral del panel ocupa los primeros 240 px de la
   captura y, ampliada al 150%, se colaba en el encuadre como una franja blanca
   muerta a la izquierda. Con este desplazamiento el recorte empieza justo
   donde empieza el contenido. */
.marco.detalle img{width:150%;left:-26%;top:var(--zoom-top, -225px)}
/*
  La animación va ligada a la clase .on de la escena, no puesta directamente
  en la imagen: puesta en el elemento desde el primer pintado, las 11 escenas
  arrancan su cuenta de 10s a la vez en cuanto carga la página (todas están
  en el DOM, solo la opacidad las oculta). Para cuando una escena tardía se
  hace visible, su animación ya ha terminado y el fill-mode "both" la deja
  congelada en el estado final — un desplazamiento de -4% permanente que
  corta cabeceras y menús pegados al borde superior de la captura durante
  toda la escena, no solo un instante. Atada a .on, cada imagen empieza a
  moverse justo cuando el espectador empieza a verla.

  Solo desplazamiento vertical, sin scale(): el zoom continuo sobre el PNG de
  una captura de interfaz reescala el texto fino en cada fotograma y sale con
  un desenfoque de sub-píxel perceptible, sobre todo a 1080p.
*/
.escena.on .marco img{animation:deriva 10s ease-in-out both}
/* -1,5%, no -4%: en una escena larga la animación sí llega a completarse y
   se queda en el estado final durante el resto de la escena — con -4% eso
   bastaba para tapar una cabecera pegada al borde superior del recorte. */
@keyframes deriva{from{transform:translateY(0)}to{transform:translateY(-1.5%)}}
.pie{position:absolute;left:0;right:0;bottom:0;padding:36px 87px 42px;
     background:linear-gradient(transparent,rgba(10,8,7,.95) 34%)}
/* Título y subtítulo de cada escena. Suben de 48/25 px porque esta línea es la
   pista de subtítulos del que ve el vídeo sin sonido, que en WhatsApp es la
   mayoría: a 25 px se quedaba en cinco píxeles en una pantalla de teléfono. */
h2{font-family:'Fraunces',Georgia,serif;font-weight:600;letter-spacing:-.01em;
   font-size:56px;line-height:1.1}
p{font-family:'Inter',sans-serif;font-size:38px;color:#d6cfc7;margin-top:11px}
.barra-pista{position:absolute;left:0;bottom:0;height:4px;width:100%;background:rgba(255,255,255,.08)}
.barra{position:absolute;left:0;bottom:0;height:4px;background:#d97706;width:0;
       animation:crece ${total}s linear both}
@keyframes crece{to{width:100%}}
.marca{position:absolute;top:42px;left:54px;display:flex;align-items:center;gap:14px;
       font-family:'Fraunces',serif;font-weight:600;font-size:27px;letter-spacing:-.01em;color:#fff}
.marca .punto{width:10px;height:10px;border-radius:50%;background:#d97706}
.num{position:absolute;top:45px;right:57px;font-size:20px;color:#a89f96;letter-spacing:.06em}

/* ── Tarjeta de cierre ────────────────────────────────────────────────
   La única escena que no es una captura. Va sobre el fondo del vídeo, sin
   marco blanco: el resto del vídeo enseña producto y este momento no enseña,
   pide. Tipografía grande porque tiene que leerse de un vistazo en un móvil. */
.tarjeta{display:flex;flex-direction:column;align-items:center;text-align:center;gap:26px}
.tarjeta .nombre{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:104px;
                 line-height:1;letter-spacing:-.02em;color:#fff}
.tarjeta .puntos{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}
.tarjeta .puntos span{font-size:27px;color:#f2ede7;border:1px solid rgba(217,119,6,.55);
                      border-radius:999px;padding:13px 28px;background:rgba(217,119,6,.12)}
.tarjeta .cta{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:50px;color:#f59e0b;
              margin-top:12px}
/* Quién firma. En el momento de pedir la respuesta, la pantalla tenía solo un
   dominio en gris: la voz decía "me llamo Pablo" y no había forma de leerlo
   ni de escribirle si el vídeo llegaba reenviado. */
.tarjeta .firma{margin-top:6px;display:flex;flex-direction:column;gap:6px;align-items:center}
.tarjeta .firma .quien{font-size:31px;color:#f2ede7;font-weight:600}
.tarjeta .firma .correo{font-size:27px;color:#d9b382}
.tarjeta .web{font-size:24px;color:#8d8479;letter-spacing:.02em;margin-top:2px}
/* La tarjeta es lo único fijo del vídeo y son sus últimos segundos: una
   entrada corta evita que el cierre parezca un fotograma congelado. */
.escena.on .tarjeta{animation:entra 1.1s ease-out both}
@keyframes entra{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

/* ── Declaración ──────────────────────────────────────────────────────
   Una frase a pantalla completa, sin captura. Se usa para el argumento del
   anti-solape: cualquier pantallazo del panel que lo "ilustre" acaba siendo
   texto de interfaz de 3 px cuando el vídeo se ve en un teléfono, que es como
   llega por WhatsApp. Escrito así se lee en cualquier pantalla, y de paso
   rompe la sucesión de nueve cuadros idénticos. */
.declaracion{max-width:1400px;text-align:center;display:flex;flex-direction:column;
             align-items:center;gap:30px}
.declaracion .frase{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:84px;
                    line-height:1.14;letter-spacing:-.015em;color:#fff}
.declaracion .frase em{font-style:normal;color:#f59e0b}
.declaracion .subraya{width:132px;height:5px;border-radius:3px;background:#d97706}
.declaracion .apoyo{font-size:34px;color:#c9c0b6;line-height:1.4;max-width:1080px}
.escena.on .declaracion{animation:entra 1s ease-out both}
/* Cifras del negocio. La captura de informes tiene las etiquetas en 22 px:
   dentro del cuadro se quedan en cuatro píxeles y media pantalla de teléfono,
   así que sobre ella la voz cantaba tres datos que no se podían comprobar.
   Escritos así son los mismos números, legibles. */
.declaracion .cifras{display:flex;gap:78px;flex-wrap:wrap;justify-content:center;margin-top:6px}
.declaracion .cifra{display:flex;flex-direction:column;align-items:center;gap:6px}
.declaracion .cifra b{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:96px;
                      line-height:1;color:#f59e0b}
.declaracion .cifra span{font-size:31px;color:#c9c0b6}
/* De dónde salen las cifras. Cuando eran una captura del panel se veía solo
   con mirarla; escritas en grande y en segunda persona ("entran por TU web")
   se leen como una promesa de resultados si no se dice de quién son. */
.declaracion .nota{font-size:27px;color:#a89f96;margin-top:4px}
</style></head><body>
<div class="fondo"></div>
<div class="marca"><span class="punto"></span>${MARCA} · ${MARCA_COLA}</div>
${conTiempo.map((e, i) => {
  const cuerpo = e.declaracion
    ? `<div class="declaracion">
    <div class="frase">${e.declaracion.frase}</div>
    <div class="subraya"></div>
    ${e.declaracion.apoyo ? `<div class="apoyo">${e.declaracion.apoyo}</div>` : ""}
    ${e.declaracion.cifras ? `<div class="cifras">${e.declaracion.cifras
      .map(([n, t]) => `<div class="cifra"><b>${n}</b><span>${t}</span></div>`).join("")}</div>` : ""}
    ${e.declaracion.nota ? `<div class="nota">${e.declaracion.nota}</div>` : ""}
  </div>`
    : e.tarjeta
    ? `<div class="tarjeta">
    <div class="nombre">${MARCA}</div>
    <div class="puntos">${e.tarjeta.puntos.map((p) => `<span>${p}</span>`).join("")}</div>
    <div class="cta">${e.tarjeta.cta}</div>
    <div class="firma">
      <span class="quien">${e.tarjeta.firma}</span>
      <span class="correo">${e.tarjeta.correo}</span>
    </div>
    <div class="web">${e.tarjeta.web}</div>
  </div>`
    : `<div class="marco ${["movil", "detalle", "chat", "paso"].includes(e.encuadre) ? e.encuadre : ""}"
       ${e.zoomTop ? `style="--zoom-top:${e.zoomTop}"` : ""}>
    <img src="data:image/png;base64,${imagenes[e.imagen]}" alt="">
  </div>`;
  // La primera escena nace ya visible: si entra con el fundido de opacidad,
  // el vídeo arranca con casi un segundo de pantalla vacía mientras la
  // locución ya ha empezado a sonar.
  return `<div class="escena${i === 0 ? " on" : ""}" data-in="${e.inicio.toFixed(2)}" data-out="${(e.inicio + e.dur).toFixed(2)}">
  <div class="num">${String(i + 1).padStart(2, "0")} / ${escenas.length}</div>
  ${cuerpo}
  <div class="pie"><h2>${e.titulo}</h2><p>${e.subtitulo}</p></div>
</div>`;
}).join("\n")}
<div class="barra-pista"></div>
<div class="barra"></div>
<script>
const escenas=[...document.querySelectorAll('.escena')];
// El reloj arranca solo cuando la fuente ya está aplicada: si no, el primer
// titular sale un instante en la tipografía del sistema y se nota el salto
// en el vídeo grabado (Playwright graba desde la navegación, no desde aquí).
document.fonts.ready.then(()=>{
  const t0=performance.now();
  function pinta(){
    const t=(performance.now()-t0)/1000;
    for(const e of escenas){
      const dentro = t>=+e.dataset.in && t<+e.dataset.out;
      e.classList.toggle('on', dentro);
    }
    requestAnimationFrame(pinta);
  }
  requestAnimationFrame(pinta);
});
</script></body></html>`;

const htmlPath = join(TRABAJO, "anim.html");
writeFileSync(htmlPath, html);
console.log("Animación construida.");

// ── 5. Grabar ─────────────────────────────────────────────────────────
console.log("Grabando…");
const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: ANCHO, height: ALTO },
  recordVideo: { dir: TRABAJO, size: { width: ANCHO, height: ALTO } },
});
const page = await ctx.newPage();
// La grabación empieza en cuanto se crea el contexto, con el fondo blanco
// por defecto de about:blank — y anim.html tarda un instante en parsear
// (lleva las 11 capturas incrustadas en base64, varios MB) antes de pintar
// su propio fondo oscuro. Sin este paso, el vídeo arrancaba con ~0,35s de
// fogonazo blanco mientras la locución ya había empezado a sonar.
await page.goto(`data:text/html,<style>html,body{background:${encodeURIComponent("#161311")};height:100%}</style>`);
await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "load" });
// Espera a que las fuentes de Google Fonts terminen de cargar antes de que
// arranque el temporizador: si no, el primer titular sale en la tipografía
// del sistema durante un instante y se nota el "salto" al vídeo grabado.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.waitForTimeout(total * 1000 + 900);
await ctx.close();
await navegador.close();

const webm = readdirSync(TRABAJO).find((f) => f.endsWith(".webm"));
if (!webm) throw new Error("Playwright no generó el vídeo");
const mudo = join(TRABAJO, "mudo.webm");
renameSync(join(TRABAJO, webm), mudo);

// ── 6. Vídeo + voz ────────────────────────────────────────────────────
console.log("Uniendo imagen y voz…");
const mp4 = join(SALIDA, NOMBRE_VIDEO);
execFileSync(FFMPEG, [
  "-y", "-i", mudo, "-i", join(TRABAJO, "narracion.mp3"),
  "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
  mp4,
], { stdio: "pipe" });

const kb = (p) => Math.round(readFileSync(p).length / 1024);
console.log(`\nListo:`);
console.log(`  ${mp4}  (${kb(mp4)} KB, ${total.toFixed(1)} s)`);
