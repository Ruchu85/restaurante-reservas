/**
 * mock-whatsapp.mjs — Dibuja el mensaje de confirmación que envía la app.
 *
 *   node demo/mock-whatsapp.mjs
 *
 * La captura original era una foto de un WhatsApp real y arrastraba tres cosas
 * que en un vídeo de venta restan más de lo que aporta el realismo:
 *
 *  - El enlace salía como `reservas-restaurante-demo.vercel.app/reservar/...`,
 *    en azul, subrayado y a tres líneas: el elemento más llamativo del globo
 *    durante ocho segundos. Un subdominio de hosting gratuito en el mensaje
 *    que recibe el cliente del restaurante dice "prototipo" muy alto, justo
 *    después de que la voz prometa "te monto la web de tu restaurante, tuyo".
 *  - El remitente era "Restaurante Demo" mientras el resto del vídeo enseña
 *    "Restaurante Los Angeles": dos restaurantes ficticios seguidos.
 *  - La fecha era el 19 de diciembre, pero la escena anterior reserva el 19 de
 *    agosto. La voz encadena las dos con un pronombre ("y LE llega la
 *    confirmación"), así que tienen que ser la misma reserva.
 *
 * El texto reproduce la plantilla real de confirmación, y el enlace usa el
 * dominio propio, que es el formato que envía el sistema en producción.
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("./capturas/17b-whatsapp-recorte.png", import.meta.url));

// Tiene que cuadrar con lo que se elige en la escena anterior del vídeo.
const RESERVA = {
  restaurante: "Restaurante Los Angeles",
  cliente: "Marina",
  fecha: "miércoles, 19 de agosto",
  hora: "21:00",
  personas: "2 personas",
  enlace: "cita-lista.es/reservar/8f2a1c",
  recibido: "20:14",
};

const html = `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1170px;height:1120px;font-family:'Inter',system-ui,sans-serif;
     background:#ece5dd;display:flex;flex-direction:column}
.barra{background:#075e54;color:#fff;padding:34px 40px;display:flex;align-items:center;gap:26px}
.atras{font-size:44px;line-height:1;opacity:.9}
.avatar{width:96px;height:96px;border-radius:50%;background:#d97706;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        font-family:Georgia,serif;font-weight:700;font-size:44px;color:#fff}
.quien{font-size:42px;font-weight:600;line-height:1.2}
.estado{font-size:28px;opacity:.75;margin-top:4px}
.chat{flex:1;padding:44px 40px;display:flex;flex-direction:column;align-items:center;gap:34px}
.dia{background:#dbf0f7;color:#54656f;font-size:26px;font-weight:600;
     padding:11px 26px;border-radius:12px;letter-spacing:.04em}
.globo{align-self:flex-start;background:#fff;border-radius:16px;padding:34px 36px 24px;
       max-width:960px;box-shadow:0 1px 2px rgba(0,0,0,.13);font-size:36px;line-height:1.48;color:#111b21}
.globo b{font-weight:700}
.datos{margin:26px 0;display:flex;flex-direction:column;gap:12px;font-size:36px}
.datos div{display:flex;align-items:center;gap:16px}
.enlace{color:#027eb5;text-decoration:underline;word-break:normal}
.hora{text-align:right;font-size:26px;color:#667781;margin-top:14px}
</style>
<div class="barra">
  <span class="atras">‹</span>
  <div class="avatar">L</div>
  <div><div class="quien">${RESERVA.restaurante}</div><div class="estado">en línea</div></div>
</div>
<div class="chat">
  <div class="dia">HOY</div>
  <div class="globo">
    Hola ${RESERVA.cliente}, tu reserva en <b>${RESERVA.restaurante}</b> está confirmada.
    <div class="datos">
      <div><span>📅</span><span>${RESERVA.fecha}</span></div>
      <div><span>🕘</span><span>${RESERVA.hora} · ${RESERVA.personas}</span></div>
    </div>
    Ver o cancelar desde este enlace: <span class="enlace">${RESERVA.enlace}</span> — gracias por
    reservar con nosotros.
    <div class="hora">${RESERVA.recibido}</div>
  </div>
</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1170, height: 1120 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT });
await browser.close();
console.log("Escrito", OUT);
