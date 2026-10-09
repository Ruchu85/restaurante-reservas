/**
 * capturar.mjs — Capturas reales de la app para el material comercial.
 * Uso: node demo/capturar.mjs [url]
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js";

const BASE = process.argv[2] || "https://reservas-restaurante-demo.vercel.app";
// fileURLToPath, no .pathname: en Windows el pathname viene URL-encoded
// ("APP%20Restaurantes") y las capturas acaban en una carpeta fantasma.
const OUT = fileURLToPath(new URL("./capturas/", import.meta.url));
mkdirSync(OUT, { recursive: true });

function env(k) {
  const l = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).find((x) => x.startsWith(k + "="));
  return l ? l.slice(k.length + 1).trim() : "";
}

// Sábado de diciembre: el servicio más lleno del año, el que mejor enseña la app.
const DIA_FUERTE = "2026-12-19";

const VISTAS = [
  ["01-panel",       "/dashboard"],
  ["02-calendario",  "/dashboard/calendario"],
  ["03-dia",         `/dashboard/calendario?date=${DIA_FUERTE}`],
  ["04-reservas",    `/dashboard/reservas?date=${DIA_FUERTE}`],
  ["05-comensales",  "/dashboard/comensales"],
  ["06-informes",    "/dashboard/informes"],
  ["07-mesas",       "/dashboard/mesas"],
  ["08-horarios",    "/dashboard/horarios"],
];

async function entrar(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "admin@restaurante-demo.com");
  await page.fill('input[type="password"]', "Admin1234!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function shot(page, nombre, full = true) {
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}${nombre}.png`, fullPage: full });
  console.log("  ✓", nombre);
}

const browser = await chromium.launch();

// ── Escritorio ────────────────────────────────────────────────────────
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await desktop.newPage();
await entrar(page);
console.log("Escritorio:");
for (const [nombre, ruta] of VISTAS) {
  await page.goto(BASE + ruta, { waitUntil: "networkidle" });
  await shot(page, nombre);
}

// Franja horaria desplegada con el detalle mesa a mesa: la función más nueva
// del panel, y la que mejor demuestra "sabes al momento qué mesa está libre"
// en una sola captura. Se elige la franja más ocupada del día fuerte, no la
// primera, para que el compuesto de mesas enseñe varias fichas ocupadas.
await page.goto(`${BASE}/dashboard/calendario?date=${DIA_FUERTE}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
// El parámetro ?date= solo fija qué día queda seleccionado; la vista sigue
// arrancando en "mes" siempre, así que hay que pulsar "Ver día" para
// llegar a la vista diaria con las franjas horarias.
await page.getByText("Ver día").click();
await page.waitForTimeout(600);
// :visible descarta el botón "Más" del menú móvil: mismo atributo
// aria-expanded, pero oculto por CSS (md:hidden) en el viewport de escritorio.
const franjas = page.locator('button[aria-expanded="false"]:visible');
const nFranjas = await franjas.count();
let mejorFranja = { idx: 0, ocupadas: -1 };
for (let i = 0; i < nFranjas; i++) {
  const texto = await franjas.nth(i).innerText();
  const m = texto.match(/(\d+)\/(\d+)\s*lib/);
  if (m) {
    const ocupadas = Number(m[2]) - Number(m[1]);
    if (ocupadas > mejorFranja.ocupadas) mejorFranja = { idx: i, ocupadas };
  }
}
if (nFranjas > 0) await franjas.nth(mejorFranja.idx).click();
// El contenido desplaza al pulsar (Playwright hace scroll del elemento a la
// vista), y el panel scrollea por dentro de <main>, no por el documento: una
// captura fullPage no ve más allá del viewport aquí. Se vuelve arriba antes
// de disparar, para que la cabecera del día y el turno queden en la imagen
// junto con la franja abierta.
await page.evaluate(() => document.querySelector("main")?.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}03b-dia-franja.png`, fullPage: false });
console.log("  ✓ 03b-dia-franja");

// Resumen del mes + origen de las reservas, apilados en un compuesto: la
// proporción del marco del vídeo es más ancha que alta, y las dos secciones
// por separado o la página entera de Informes no encajan sin recortar alguna.
//
// Tienen que ser ESTAS dos secciones, no otras: la locución de esa escena
// promete "cuánta gente ha pasado, de dónde vienen tus reservas y cuántos te
// han fallado", y las tres cifras están justo aquí. Con el gráfico semanal en
// su lugar, la voz prometía un dato que no aparecía en pantalla.
await page.goto(`${BASE}/dashboard/informes`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const tarjetaResumen = page.locator("h2", { hasText: "Resumen del mes" }).locator("xpath=..");
const tarjetaSemanal = page.locator("h2", { hasText: "Origen de reservas" }).locator("xpath=..");
const [bufResumen, bufSemanal] = await Promise.all([
  tarjetaResumen.screenshot(),
  tarjetaSemanal.screenshot(),
]);
const metaResumen = await sharp(bufResumen).metadata();
const metaSemanal = await sharp(bufSemanal).metadata();
const anchoCompuesto = Math.max(metaResumen.width, metaSemanal.width);
const gapCompuesto = 16;
await sharp({
  create: {
    width: anchoCompuesto,
    height: metaResumen.height + gapCompuesto + metaSemanal.height,
    channels: 4,
    background: "#f5f5f4",
  },
})
  .composite([
    { input: bufResumen, left: 0, top: 0 },
    { input: bufSemanal, left: 0, top: metaResumen.height + gapCompuesto },
  ])
  .png()
  .toFile(`${OUT}16-informes-compuesto.png`);
console.log("  ✓ 16-informes-compuesto");

// Ficha de un comensal con historial real: la primera de la lista puede
// salir sin alergias ni notas rellenas, y entonces se enseña el formulario
// vacío justo cuando el guion dice "sus notas de sala y sus alergias".
// Paula Moreno tiene 17 visitas, alergia al gluten y nota de sala — fija a
// propósito en vez de "la primera que salga".
await page.goto(`${BASE}/dashboard/comensales/6bddd97e-6035-4899-a3a3-a49053358c95`, { waitUntil: "networkidle" });
await shot(page, "09-ficha-comensal");

// Web pública
await page.goto(BASE, { waitUntil: "networkidle" });
const alto = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < alto; y += 450) { await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(200); }
await page.evaluate(() => scrollTo(0, 0));
await shot(page, "10-web-publica");

// ── Móvil ─────────────────────────────────────────────────────────────
console.log("Móvil:");
const movil = await browser.newContext({ ...devices["iPhone 13"] });
const m = await movil.newPage();
await entrar(m);
for (const [nombre, ruta] of [["m1-panel", "/dashboard"], ["m2-reservas", `/dashboard/reservas?date=${DIA_FUERTE}`], ["m3-comensales", "/dashboard/comensales"]]) {
  await m.goto(BASE + ruta, { waitUntil: "networkidle" });
  await shot(m, nombre);
}
await m.goto(`${BASE}/reservar`, { waitUntil: "networkidle" });
await shot(m, "m4-reservar", false);

// El vídeo se abre casi siempre en un teléfono, porque llega por WhatsApp. Las
// capturas de escritorio del panel, reducidas al cuadro del vídeo y vistas en
// una pantalla de 390 px, dejan el texto en dos o tres píxeles: se ven barras
// de color y poco más. Estas dos son las mismas pantallas tomadas a lo ancho
// de un móvil, donde el texto sí se lee.

// Vista de día con una franja desplegada.
await m.goto(`${BASE}/dashboard/calendario?date=${DIA_FUERTE}`, { waitUntil: "networkidle" });
await m.waitForTimeout(1000);
await m.getByText("Ver día").click().catch(() => {});
await m.waitForTimeout(700);
const franjasM = m.locator('button[aria-expanded="false"]:visible');
const nM = await franjasM.count();
let mejorM = { idx: 0, ocupadas: -1 };
for (let i = 0; i < nM; i++) {
  const t = await franjasM.nth(i).innerText();
  const g = t.match(/(\d+)\/(\d+)\s*lib/);
  if (g) {
    const ocupadas = Number(g[2]) - Number(g[1]);
    if (ocupadas > mejorM.ocupadas) mejorM = { idx: i, ocupadas };
  }
}
if (nM > 0) await franjasM.nth(mejorM.idx).click();
await m.evaluate(() => document.querySelector("main")?.scrollTo(0, 0));
await m.waitForTimeout(400);
await m.screenshot({ path: `${OUT}m5-franja.png`, fullPage: false });
console.log("  ✓ m5-franja");

// Servicio completo: el sistema no ofrece una hora que ya no tiene mesa. Es la
// demostración del "no se puede reservar dos veces", vista por el cliente.
await m.goto(`${BASE}/reservar`, { waitUntil: "networkidle" });
await m.locator('[role="group"] > button').filter({ hasText: /^4$/ }).first().click().catch(() => {});
await m.waitForTimeout(300);
await m.getByRole("button", { name: /ver horarios disponibles/i }).first().click().catch(() => {});
await m.waitForTimeout(2500);
await m.evaluate(() => window.scrollTo(0, 0));
await m.waitForTimeout(300);
await m.screenshot({ path: `${OUT}m6-completo.png`, fullPage: false });
console.log("  ✓ m6-completo");

await browser.close();

// ── Derivadas ─────────────────────────────────────────────────────────
// Recortes de imágenes que no se capturan aquí (son material fijo), pero que
// el vídeo necesita encuadradas de otra forma. Se generan si existe el origen.
console.log("Derivadas:");
async function recortar(origen, destino, region) {
  const src = `${OUT}${origen}`;
  if (!existsSync(src)) {
    console.log("  – falta", origen);
    return;
  }
  await sharp(src).extract(region).png().toFile(`${OUT}${destino}`);
  console.log("  ✓", destino);
}

// La galería de ambiente es un mosaico de fotos con separaciones blancas: como
// plano de apertura se lee como "sección galería de una web", no como una sala.
// Recortada a la foto grande queda un plano de mesa puesta que sí acompaña a lo
// que cuenta la voz.
// El recorte es apaisado (2,18:1) a propósito, la proporción del marco del
// vídeo: en cuadrado, el marco solo enseña la mitad de arriba de la imagen y
// se quedaba en la ventana, sin llegar a la mesa puesta que es el asunto.
await recortar("14-ambiente.png", "18-mesa-noche.png", { left: 160, top: 410, width: 740, height: 340 });

// La captura del móvil es altísima y deja la conversación diminuta en el centro
// del cuadro. Recortada a la cabecera y el mensaje se lee en un teléfono.
await recortar("17-whatsapp-confirmacion.png", "17b-whatsapp-recorte.png", { left: 0, top: 0, width: 1170, height: 1120 });

// Una franja al completo, con las ocho mesas ocupadas y su nombre. Es la
// imagen del argumento de "no se puede reservar dos veces la misma mesa":
// antes iba con el calendario del mes, que sobre ese texto se leía como
// "aquí no reserva nadie".
await recortar("03b-dia-franja.png", "20-franja-llena.png", { left: 370, top: 160, width: 960, height: 440 });

// Las cinco filas del listado que enseñan visitas, no-shows, cliente habitual
// y alergia. Antes esta escena ampliaba la captura entera al 150%, y la
// interfaz salía cortada por tres lados.
await recortar("04-reservas.png", "21-cliente.png", { left: 352, top: 320, width: 978, height: 446 });

// Las dos capturas móviles que usa el vídeo, recortadas a las filas que
// sostienen el argumento. Enseñar el teléfono entero dentro del cuadro deja el
// texto casi tan pequeño como en la captura de escritorio: lo que hace falta
// no es la pantalla completa, es que se lea lo que la voz está diciendo.
await recortar("m5-franja.png", "m5b-franja.png", { left: 0, top: 850, width: 1170, height: 534 });
await recortar("m3-comensales.png", "m3b-comensales.png", { left: 0, top: 1020, width: 1170, height: 534 });

console.log(`\nCapturas en ${OUT}`);
