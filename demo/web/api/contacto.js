/**
 * Recoge el formulario de contacto y lo manda por correo con Resend.
 *
 * Antes la única forma de contactar era un enlace `mailto:`. En móvil —que es
 * por donde entra este público— abre un cliente de correo que mucha gente con
 * Gmail o webmail no tiene configurado, así que el clic se perdía en silencio
 * y no había forma de medir cuántos se perdían.
 */

const DESTINO = "pablo.fernandez@cita-lista.es";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  let datos = req.body;
  if (typeof datos === "string") {
    try { datos = JSON.parse(datos); } catch { datos = {}; }
  }
  datos = datos || {};

  // Trampa para robots: es un campo oculto que una persona nunca rellena.
  // Se responde 200 a propósito para que el bot crea que ha funcionado y no
  // reintente por otra vía.
  if (datos.web_url) return res.status(200).json({ ok: true });

  const nombre = String(datos.nombre || "").trim();
  const restaurante = String(datos.restaurante || "").trim();
  const email = String(datos.email || "").trim();
  const telefono = String(datos.telefono || "").trim();
  const mesas = String(datos.mesas || "").trim();
  const tieneWeb = String(datos.tiene_web || "").trim();
  const mensaje = String(datos.mensaje || "").trim();
  // De qué campaña o enlace viene la solicitud (lo rellena formulario.js).
  const origen = String(datos.origen || "").trim().slice(0, 200);
  const preferencia = String(datos.preferencia || "").trim().slice(0, 80);

  if (!nombre || !restaurante || !email) {
    return res.status(400).json({ ok: false, error: "Faltan nombre, restaurante o email." });
  }
  // El consentimiento es la base jurídica del tratamiento: sin él no se recoge
  // nada. Se comprueba también aquí y no solo con el `required` del HTML, que
  // se salta cualquiera que envíe la petición a mano.
  const consiente = datos.consiento;
  if (!(consiente === true || consiente === "on" || consiente === "true" || consiente === "1")) {
    return res.status(400).json({ ok: false, error: "Hay que aceptar el tratamiento de datos para poder contestarte." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Ese correo no parece válido." });
  }
  // Un mensaje larguísimo es casi siempre spam, y de paso acota el tamaño.
  if (mensaje.length > 4000) {
    return res.status(400).json({ ok: false, error: "El mensaje es demasiado largo." });
  }

  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.RESEND_FROM_EMAIL;
  if (!clave || !remitente) {
    console.error("Faltan RESEND_API_KEY o RESEND_FROM_EMAIL en el entorno");
    return res.status(500).json({ ok: false, error: "El formulario no está disponible ahora mismo." });
  }

  const filas = [
    ["Nombre", nombre],
    ["Restaurante", restaurante],
    ["Email", email],
    ["Teléfono", telefono || "—"],
    ["Mesas", mesas || "—"],
    ["¿Tiene web?", tieneWeb || "—"],
    ["Cómo prefiere empezar", preferencia || "—"],
    ["Origen", origen || "directo"],
  ];

  const texto =
    filas.map(([k, v]) => `${k}: ${v}`).join("\n") +
    (mensaje ? `\n\nMensaje:\n${mensaje}` : "");

  const html =
    `<h2 style="font-family:system-ui">Nueva solicitud de prueba</h2>` +
    `<table style="font-family:system-ui;border-collapse:collapse">` +
    filas.map(([k, v]) =>
      `<tr><td style="padding:4px 12px 4px 0"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`
    ).join("") +
    `</table>` +
    (mensaje ? `<p style="font-family:system-ui"><b>Mensaje:</b><br>${esc(mensaje).replace(/\n/g, "<br>")}</p>` : "");

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remitente,
        to: [DESTINO],
        // Así se puede responder al restaurante directamente desde el aviso.
        reply_to: email,
        subject: `Cita-Lista · ${restaurante} (${nombre})`,
        text: texto,
        html,
      }),
    });

    if (!r.ok) {
      console.error("Resend respondió", r.status, await r.text());
      return res.status(502).json({ ok: false, error: "No se pudo enviar. Escríbeme a " + DESTINO });
    }
    // Sin JavaScript el navegador envía el formulario a pelo y esperaría ver
    // JSON en pantalla. En ese caso se redirige a una página de gracias.
    const tipo = String(req.headers["content-type"] || "");
    if (tipo.includes("form-urlencoded") || tipo.includes("multipart/form-data")) {
      res.setHeader("Location", "/gracias");
      return res.status(303).end();
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Fallo enviando el formulario:", e);
    return res.status(502).json({ ok: false, error: "No se pudo enviar. Escríbeme a " + DESTINO });
  }
}
