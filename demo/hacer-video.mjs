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
import { mkdirSync, writeFileSync, readdirSync, renameSync, rmSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ESCENAS, VOZ, RITMO } from "./guion.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const CAPTURAS = join(DIR, "capturas");
const TRABAJO = join(DIR, ".trabajo");
const SALIDA = join(DIR, "web", "media");

const PY = join(DIR, "..", "prospect-system", "venv", "Scripts", "python.exe");
const FFMPEG = process.env.FFMPEG_PATH || join(
  process.env.TEMP || "/tmp",
  "claude/d--Proyectos-Claude-APP-Restaurantes/7473faa5-088d-4d46-a279-3514556f8c10/scratchpad",
  "tools/node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg.exe",
);

const ANCHO = 1280;
const ALTO = 720;

rmSync(TRABAJO, { recursive: true, force: true });
mkdirSync(TRABAJO, { recursive: true });
mkdirSync(SALIDA, { recursive: true });

// ── 1. Locución ───────────────────────────────────────────────────────
console.log(`Sintetizando ${ESCENAS.length} locuciones con ${VOZ}…`);
for (const e of ESCENAS) {
  const mp3 = join(TRABAJO, `voz-${e.id}.mp3`);
  execFileSync(PY, ["-m", "edge_tts", "--voice", VOZ, "--rate", RITMO, "--text", e.texto, "--write-media", mp3], {
    stdio: "pipe",
  });
  process.stdout.write(`  ${e.id}`);
}
console.log();

// ── 2. Duración real de cada escena ───────────────────────────────────
function duracion(archivo) {
  // ffmpeg escribe la duración en stderr; no hace falta ffprobe.
  const salida = execFileSync(FFMPEG, ["-i", archivo], { stdio: ["ignore", "pipe", "pipe"] , encoding: "utf8"})
    .toString();
  return salida;
}
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

const PAUSA = 0.55; // respiración entre escenas
const escenas = ESCENAS.map((e) => {
  const d = segundos(join(TRABAJO, `voz-${e.id}.mp3`));
  return { ...e, dur: d + PAUSA };
});
const total = escenas.reduce((s, e) => s + e.dur, 0);
console.log(`Duración total: ${total.toFixed(1)} s`);

// ── 3. Audio único ────────────────────────────────────────────────────
// Se concatena insertando el silencio de la pausa detrás de cada locución.
const lista = escenas
  .map((e) => `file '${join(TRABAJO, `voz-${e.id}.mp3`).replace(/\\/g, "/")}'`)
  .join("\n");
writeFileSync(join(TRABAJO, "lista.txt"), lista);

const filtro = escenas
  .map((_, i) => `[${i}:a]adelay=0|0,apad=pad_dur=${PAUSA}[a${i}]`)
  .join(";");
const entradas = escenas.flatMap((e) => ["-i", join(TRABAJO, `voz-${e.id}.mp3`)]);
const concat = escenas.map((_, i) => `[a${i}]`).join("") + `concat=n=${escenas.length}:v=0:a=1[out]`;

execFileSync(FFMPEG, [
  "-y", ...entradas,
  "-filter_complex", `${filtro};${concat}`,
  "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "3",
  join(TRABAJO, "narracion.mp3"),
], { stdio: "pipe" });
console.log("Audio unificado.");

// ── 4. Animación HTML ─────────────────────────────────────────────────
function b64(archivo) {
  return readFileSync(join(CAPTURAS, archivo)).toString("base64");
}
const imagenes = {};
for (const e of escenas) if (!imagenes[e.imagen]) imagenes[e.imagen] = b64(e.imagen);

let t = 0;
const conTiempo = escenas.map((e) => {
  const inicio = t;
  t += e.dur;
  return { ...e, inicio };
});

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${ANCHO}px;height:${ALTO}px;overflow:hidden;background:#1c1917;
     font-family:'Segoe UI',system-ui,sans-serif;color:#fff}
.escena{position:absolute;inset:0;opacity:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;padding:38px 56px 96px}
.escena.on{opacity:1}
.marco{position:relative;width:100%;max-width:1000px;height:470px;border-radius:14px;
       overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.55);background:#fff}
.marco img{position:absolute;left:0;top:0;width:100%;
           transform-origin:top center;animation:deriva 9s linear both}
.marco.movil{max-width:290px;height:560px}
.marco.movil img{width:100%}
.marco.detalle img{width:150%;left:-14%;top:-150px}
@keyframes deriva{from{transform:translateY(0)}to{transform:translateY(-6%)}}
.pie{position:absolute;left:0;right:0;bottom:0;padding:22px 56px 26px;
     background:linear-gradient(transparent,rgba(12,10,9,.94) 32%)}
h2{font-size:31px;font-weight:700;letter-spacing:-.02em}
p{font-size:17px;color:#d6d3d1;margin-top:5px}
.barra{position:absolute;left:0;bottom:0;height:4px;background:#f59e0b;width:0;
       animation:crece ${total}s linear both}
@keyframes crece{to{width:100%}}
.marca{position:absolute;top:26px;left:34px;font-size:15px;font-weight:700;
       letter-spacing:.09em;color:#f59e0b;text-transform:uppercase}
</style></head><body>
<div class="marca">Reservas para restaurantes</div>
${conTiempo.map((e) => `<div class="escena" data-in="${e.inicio.toFixed(2)}" data-out="${(e.inicio + e.dur).toFixed(2)}">
  <div class="marco ${e.encuadre === "movil" ? "movil" : e.encuadre === "detalle" ? "detalle" : ""}">
    <img src="data:image/png;base64,${imagenes[e.imagen]}" alt="">
  </div>
  <div class="pie"><h2>${e.titulo}</h2><p>${e.subtitulo}</p></div>
</div>`).join("\n")}
<div class="barra"></div>
<script>
const escenas=[...document.querySelectorAll('.escena')];
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
await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "load" });
await page.waitForTimeout(total * 1000 + 900);
await ctx.close();
await navegador.close();

const webm = readdirSync(TRABAJO).find((f) => f.endsWith(".webm"));
if (!webm) throw new Error("Playwright no generó el vídeo");
const mudo = join(TRABAJO, "mudo.webm");
renameSync(join(TRABAJO, webm), mudo);

// ── 6. Vídeo + voz ────────────────────────────────────────────────────
console.log("Uniendo imagen y voz…");
const mp4 = join(SALIDA, "demo.mp4");
execFileSync(FFMPEG, [
  "-y", "-i", mudo, "-i", join(TRABAJO, "narracion.mp3"),
  "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
  mp4,
], { stdio: "pipe" });

const kb = (p) => Math.round(readFileSync(p).length / 1024);
console.log(`\nListo:`);
console.log(`  ${mp4}  (${kb(mp4)} KB, ${total.toFixed(1)} s)`);
