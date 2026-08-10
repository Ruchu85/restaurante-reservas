/**
 * capturar.mjs — Capturas reales de la app para el material comercial.
 * Uso: node demo/capturar.mjs [url]
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

await browser.close();
console.log(`\nCapturas en ${OUT}`);
