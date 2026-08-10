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
// La plantilla visual reutiliza la identidad de la web real: Fraunces para
// titulares, ámbar-700 de acento, fondo piedra oscuro — para que el vídeo se
// sienta parte del mismo producto y no un genérico "explicador" de stock.
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
        align-items:center;justify-content:center;padding:40px 60px 100px;
        transition:opacity .5s ease}
.escena.on{opacity:1}
.marco{position:relative;width:100%;max-width:1010px;height:462px;border-radius:16px;
       overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06);
       background:#fff}
.marco img{position:absolute;left:0;top:0;width:100%;
           transform-origin:top center;animation:deriva 10s ease-in-out both}
.marco.movil{max-width:288px;height:558px;border-radius:26px}
.marco.movil img{width:100%}
.marco.detalle img{width:150%;left:-14%;top:-150px}
@keyframes deriva{from{transform:translateY(0) scale(1.0)}to{transform:translateY(-4%) scale(1.015)}}
.pie{position:absolute;left:0;right:0;bottom:0;padding:24px 58px 28px;
     background:linear-gradient(transparent,rgba(10,8,7,.95) 34%)}
h2{font-family:'Fraunces',Georgia,serif;font-weight:600;letter-spacing:-.01em;
   font-size:32px;line-height:1.1}
p{font-family:'Inter',sans-serif;font-size:16.5px;color:#d6cfc7;margin-top:6px}
.barra-pista{position:absolute;left:0;bottom:0;height:3px;width:100%;background:rgba(255,255,255,.08)}
.barra{position:absolute;left:0;bottom:0;height:3px;background:#d97706;width:0;
       animation:crece ${total}s linear both}
@keyframes crece{to{width:100%}}
.marca{position:absolute;top:28px;left:36px;display:flex;align-items:center;gap:9px;
       font-family:'Fraunces',serif;font-weight:600;font-size:18px;letter-spacing:-.01em;color:#fff}
.marca .punto{width:7px;height:7px;border-radius:50%;background:#d97706}
.num{position:absolute;top:30px;right:38px;font-size:13px;color:#a89f96;letter-spacing:.06em}
</style></head><body>
<div class="fondo"></div>
<div class="marca"><span class="punto"></span>Reservas para restaurantes</div>
${conTiempo.map((e, i) => `<div class="escena" data-in="${e.inicio.toFixed(2)}" data-out="${(e.inicio + e.dur).toFixed(2)}">
  <div class="num">${String(i + 1).padStart(2, "0")} / ${escenas.length}</div>
  <div class="marco ${e.encuadre === "movil" ? "movil" : e.encuadre === "detalle" ? "detalle" : ""}">
    <img src="data:image/png;base64,${imagenes[e.imagen]}" alt="">
  </div>
  <div class="pie"><h2>${e.titulo}</h2><p>${e.subtitulo}</p></div>
</div>`).join("\n")}
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
