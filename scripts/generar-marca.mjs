/**
 * generar-marca.mjs — Dibuja los logotipos de Cita-Lista.
 *
 *   node scripts/generar-marca.mjs
 *
 * Escribe en `public/brand/`, que es desde donde los sirve la web:
 *
 *  - `citalista-icon.png`  — solo la "C". Es el avatar de WhatsApp y el icono
 *    de la firma del email. Sin texto a propósito: recortado en círculo y a
 *    40 px, cualquier palabra debajo se vuelve una mancha.
 *  - `citalista-badge.png` — la "C" con el nombre debajo. Para donde se ve
 *    grande: la firma de Zoho, cabeceras, material impreso.
 *
 * Se dibuja con SVG y se rasteriza con el navegador en vez de usar una
 * herramienta de imagen porque el degradado del texto necesita tipografía
 * real: Poppins 900 para la "C" y 700 para el nombre.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/brand/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const NARANJA = "#fb923c";
const ROSA = "#ec4899";
const FONDO = "#1c1917";

/**
 * El degradado de la "C" va en diagonal, que es como nació la marca. El del
 * texto va en horizontal: sobre una palabra ancha y baja, la diagonal deja la
 * primera letra casi naranja y la última casi rosa sin transición visible, y
 * se lee como si fueran dos colores mal puestos en vez de un degradado.
 */
const defs = `
  <defs>
    <linearGradient id="cGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NARANJA}"/>
      <stop offset="100%" stop-color="${ROSA}"/>
    </linearGradient>
    <linearGradient id="txtGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${NARANJA}"/>
      <stop offset="100%" stop-color="${ROSA}"/>
    </linearGradient>
  </defs>`;

const PIEZAS = {
  "citalista-icon.png": `
    <rect x="0" y="0" width="512" height="512" fill="${FONDO}"/>
    <text x="256" y="356" font-size="360" font-weight="900" fill="url(#cGrad)" text-anchor="middle">C</text>`,

  "citalista-badge.png": `
    <rect x="0" y="0" width="512" height="512" rx="72" fill="${FONDO}"/>
    <text x="256" y="298" font-size="200" font-weight="900" fill="url(#cGrad)" text-anchor="middle">C</text>
    <text x="256" y="400" font-size="52" font-weight="700" fill="url(#txtGrad)" text-anchor="middle"
          letter-spacing="0.5">Cita-Lista</text>`,
};

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1024, height: 1024 } });

for (const [archivo, contenido] of Object.entries(PIEZAS)) {
  await pagina.setContent(
    `<!doctype html><meta charset="utf-8">
     <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;900&display=swap" rel="stylesheet">
     <style>html,body{margin:0;padding:0}svg{display:block}text{font-family:'Poppins',sans-serif}</style>
     <svg width="1024" height="1024" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
       ${defs}${contenido}
     </svg>`,
    { waitUntil: "networkidle" },
  );
  // Sin esperar a la fuente, la primera pasada sale con la del sistema.
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.locator("svg").screenshot({ path: OUT + archivo });
  console.log("  ✓", archivo);
}

await navegador.close();
console.log(`\nLogotipos en ${OUT}`);
